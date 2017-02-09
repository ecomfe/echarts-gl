(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory(require("echarts"));
	else if(typeof define === 'function' && define.amd)
		define(["echarts"], factory);
	else if(typeof exports === 'object')
		exports["echarts-gl"] = factory(require("echarts"));
	else
		root["echarts-gl"] = factory(root["echarts"]);
})(this, function(__WEBPACK_EXTERNAL_MODULE_2__) {
return /******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};

/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {

/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;

/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};

/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);

/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;

/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}


/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;

/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;

/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";

/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports, __webpack_require__) {

	__webpack_require__(1);

	__webpack_require__(35);
	__webpack_require__(36);

	__webpack_require__(81);
	__webpack_require__(87);
	__webpack_require__(88);

	__webpack_require__(94);

/***/ },
/* 1 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * echarts-gl
	 * Extension pack of ECharts providing 3d plots and globe visualization
	 *
	 * Copyright (c) 2014, echarts-gl
	 * All rights reserved.
	 *
	 * Redistribution and use in source and binary forms, with or without
	 * modification, are permitted provided that the following conditions are met:
	 *
	 * * Redistributions of source code must retain the above copyright notice, this
	 *   list of conditions and the following disclaimer.
	 *
	 * * Redistributions in binary form must reproduce the above copyright notice,
	 *   this list of conditions and the following disclaimer in the documentation
	 *   and/or other materials provided with the distribution.
	 *
	 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
	 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
	 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
	 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
	 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
	 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
	 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
	 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
	 * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
	 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
	 */

	/**
	 * @module echarts-gl
	 * @author Yi Shen(http://github.com/pissang)
	 */

	// PENDING Use a single canvas as layer or use image element?
	var echartsGl = {
	    version: '1.0.0',
	    dependencies: {
	        echarts: '3.4.0',
	        qtek: '0.3.0'
	    }
	};
	var echarts = __webpack_require__(2);
	var qtekVersion = __webpack_require__(3);
	var LayerGL = __webpack_require__(4);

	// Version checking
	var deps = echartsGl.dependencies;
	function versionTooOldMsg(name) {
	    throw new Error(
	        name + ' version is too old, needs ' + deps[name] + ' or higher'
	    );
	}
	function checkVersion(version, name) {
	    if ((version.replace('.', '') - 0) < (deps[name].replace('.', '') - 0)) {
	        versionTooOldMsg(name);
	    }
	    console.log('Loaded ' + name + ', version ' + version);
	}
	checkVersion(qtekVersion, 'qtek');
	checkVersion(echarts.version, 'echarts');

	function EChartsGL (zr) {
	    this._layers = {};

	    this._zr = zr;
	}

	EChartsGL.prototype.update = function (ecModel, api) {
	    var self = this;
	    var zr = api.getZr();

	    function getLayerGL(model) {
	        var zlevel = model.get('zlevel');
	        var layers = self._layers;
	        var layerGL = layers[zlevel];
	        if (!layerGL) {
	            layerGL = layers[zlevel] = new LayerGL('gl-' + zlevel, zr);
	            zr.painter.insertLayer(zlevel, layerGL);
	        }

	        return layerGL;
	    }

	    function wrapDispose(view, layerGL) {
	        // Wrap dispose, PENDING
	        var oldDispose = view.__oldDispose || view.dispose;
	        view.__oldDispose = oldDispose;
	        view.dispose = function () {
	            if (view.viewGL) {
	                layerGL.renderer.disposeScene(view.viewGL.scene);
	            }
	            else {
	                layerGL.renderer.disposeNode(view.groupGL);
	            }
	            oldDispose.apply(this, arguments);
	        };
	    }

	    ecModel.eachComponent(function (componentType, componentModel) {
	        if (componentType !== 'series') {
	            var view = api.getViewOfComponentModel(componentModel);
	            var groupGL = view.groupGL;
	            var coordSys = componentModel.coordinateSystem;
	            if (groupGL) {
	                var viewGL;
	                if (coordSys) {
	                    if (!coordSys.viewGL) {
	                        console.error('Can\'t find viewGL in coordinateSystem of component ' + componentModel.id);
	                        return;
	                    }
	                    viewGL = coordSys.viewGL;
	                }
	                else {
	                    if (!componentModel.viewGL) {
	                        console.error('Can\'t find viewGL of component ' + componentModel.id);
	                        return;
	                    }
	                    viewGL = coordSys.viewGL;
	                }

	                var viewGL = coordSys.viewGL;
	                var layerGL = getLayerGL(componentModel);

	                layerGL.addView(viewGL);

	                wrapDispose(view, layerGL);
	            }
	        }
	    });

	    ecModel.eachSeries(function (seriesModel) {
	        var chartView = api.getViewOfSeriesModel(seriesModel);
	        var groupGL = chartView.groupGL;
	        var coordSys = seriesModel.coordinateSystem;
	        if (groupGL) {
	            if ((coordSys && !coordSys.viewGL) && !chartView.viewGL) {
	                console.error('Can\'t find viewGL of series ' + chartView.id);
	                return;
	            }
	            var viewGL = (coordSys && coordSys.viewGL) || chartView.viewGL;
	            // TODO Check zlevel not same with component of coordinate system ?
	            var layerGL = getLayerGL(seriesModel);
	            layerGL.addView(viewGL);

	            wrapDispose(chartView, layerGL);
	        }
	    });
	};


	echarts.registerPostUpdate(function (ecModel, api) {
	    var zr = api.getZr();

	    var egl = zr.__egl = zr.__egl || new EChartsGL(zr);

	    egl.update(ecModel, api);
	});

	// Some common shaders

	module.exports = EChartsGL;

/***/ },
/* 2 */
/***/ function(module, exports) {

	module.exports = __WEBPACK_EXTERNAL_MODULE_2__;

/***/ },
/* 3 */
/***/ function(module, exports) {

	
	    module.exports = '0.3.0';


/***/ },
/* 4 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * Provide WebGL layer to zrender. Which is rendered on top of qtek.
	 *
	 *
	 * Relationship between zrender, LayerGL and ViewGL(Scene, Camera, Viewport)
	 *           zrender
	 *           /     \
	 *      LayerGL   LayerGL
	 *    (renderer) (renderer)
	 *      /     \
	 *  ViewGL   ViewGL
	 *
	 * @module echarts-gl/core/LayerGL
	 * @author Yi Shen(http://github.com/pissang)
	 */

	var Renderer = __webpack_require__(5);
	var RayPicking = __webpack_require__(25);


	// PENDING
	var Eventful = __webpack_require__(33);
	var zrUtil = __webpack_require__(34);

	/**
	 * @constructor
	 * @alias module:echarts-gl/core/LayerGL
	 * @param {string} id Layer ID
	 * @param {module:zrender/ZRender} zr
	 */
	var LayerGL = function (id, zr) {

	    Eventful.call(this);

	    /**
	     * Layer ID
	     * @type {string}
	     */
	    this.id = id;

	    /**
	     * @type {module:zrender/ZRender}
	     */
	    this.zr = zr;

	    /**
	     * @type {qtek.Renderer}
	     */
	    try {
	        this.renderer = new Renderer({
	            clear: 0,
	            devicePixelRatio: zr.painter.dpr
	        });
	        this.renderer.resize(zr.painter.getWidth(), zr.painter.getHeight());
	    }
	    catch (e) {
	        this.renderer = null;
	        this.dom = document.createElement('div');
	        this.dom.style.cssText = 'position:absolute; left: 0; top: 0; right: 0; bottom: 0;';
	        this.dom.className = 'ecgl-nowebgl';
	        this.dom.innerHTML = 'Sorry, your browser does support WebGL';

	        console.error(e);
	        return;
	    }

	    /**
	     * Canvas dom for webgl rendering
	     * @type {HTMLCanvasElement}
	     */
	    this.dom = this.renderer.canvas;
	    var style = this.dom.style;
	    style.position = 'absolute';
	    style.left = '0';
	    style.top = '0';

	    /**
	     * @type {Array.<qtek.Scene>}
	     */
	    this.views = [];

	    this._initHandlers();
	};

	/**
	 * Register event handling functions
	 */
	LayerGL.prototype._initHandlers = function () {

	    // Mouse event handling
	    this.on('click', this._clickHandler, this);
	    this.on('mousedown', this._mouseDownHandler, this);
	    this.on('mouseup', this._mouseUpHandler, this);
	    this.on('mousemove', this._mouseMoveHandler, this);

	    this._picking = new RayPicking({
	        renderer: this.renderer
	    });
	};

	/**
	 * @param {module:echarts-gl/core/ViewGL} view
	 */
	LayerGL.prototype.addView = function (view) {
	    if (view.layer === this) {
	        return;
	    }

	    this.views.push(view);

	    view.layer = this;

	    var zr = this.zr;
	    view.scene.traverse(function (node) {
	        node.__zr = zr;
	        if (node.addAnimatorsToZr) {
	            node.addAnimatorsToZr(zr);
	        }
	    });
	};

	/**
	 * @param {module:echarts-gl/core/ViewGL} view
	 */
	LayerGL.prototype.removeView = function (view) {
	    if (view.layer !== this) {
	        return;
	    }

	    var idx = this.views.indexOf(view);
	    if (idx >= 0) {
	        this.views.splice(idx, 1);

	        view.scene.traverse(function (node) {
	            var zr = node.__zr;
	            node.__zr = null;
	            if (zr && node.removeAnimatorsFromZr) {
	                node.removeAnimatorsFromZr(zr);
	            }
	        }, this);

	        view.layer = null;
	    }
	};

	/**
	 * Resize the canvas and viewport, will be invoked by zrender
	 * @param  {number} width
	 * @param  {number} height
	 */
	LayerGL.prototype.resize = function (width, height) {
	    var renderer = this.renderer;
	    renderer.resize(width, height);
	};

	/**
	 * Clear color and depth
	 * @return {[type]} [description]
	 */
	LayerGL.prototype.clear = function () {
	    var gl = this.renderer.gl;
	    gl.clearColor(0, 0, 0, 0);
	    gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);
	};

	/**
	 * Clear depth
	 */
	LayerGL.prototype.clearDepth = function () {
	    var gl = this.renderer.gl;
	    gl.clear(gl.DEPTH_BUFFER_BIT);
	};

	/**
	 * Clear color
	 */
	LayerGL.prototype.clearColor = function () {
	    var gl = this.renderer.gl;
	    gl.clearColor(0, 0, 0, 0);
	    gl.clear(gl.COLOR_BUFFER_BIT);
	};

	/**
	 * Mark layer to refresh next tick
	 */
	LayerGL.prototype.needsRefresh = function () {
	    this.zr.refresh();
	}
	/**
	 * Refresh the layer, will be invoked by zrender
	 */
	LayerGL.prototype.refresh = function () {
	    this.clear();

	    this.renderer.saveViewport();
	    for (var i = 0; i < this.views.length; i++) {
	        var viewGL = this.views[i];

	        this.renderer.setViewport(viewGL.viewport);
	        this.renderer.render(viewGL.scene, viewGL.camera);
	    }
	    this.renderer.restoreViewport();
	};

	/**
	 * Render the give scene with layer renderer and camera
	 * Without clear the buffer
	 * @return {qtek.Scene}
	 */
	LayerGL.prototype.renderScene = function (scene) {
	    this.renderer.render(scene, this.camera);
	};

	/**
	 * Dispose the layer
	 */
	LayerGL.prototype.dispose = function () {
	    this.renderer.disposeScene(this.scene);
	};

	// Event handlers
	LayerGL.prototype.onmousedown = function (e) {
	    e = e.event;
	    var obj = this.pickObject(e.offsetX, e.offsetY);
	    if (obj) {
	        this._dispatchEvent('mousedown', e, obj);
	    }
	};

	LayerGL.prototype.onmousemove = function (e) {
	    e = e.event;
	    var obj = this.pickObject(e.offsetX, e.offsetY);
	    if (obj) {
	        this._dispatchEvent('mousemove', e, obj);
	    }
	};

	LayerGL.prototype.onmouseup = function (e) {
	    e = e.event;
	    var obj = this.pickObject(e.offsetX, e.offsetY);
	    if (obj) {
	        this._dispatchEvent('mouseup', e, obj);
	    }
	};

	LayerGL.prototype.onclick = function (e) {
	    e = e.event;
	    var obj = this.pickObject(e.offsetX, e.offsetY);
	    if (obj) {
	        this._dispatchEvent('click', e, obj);
	    }
	};

	LayerGL.prototype.pickObject = function (x, y) {

	    var output = [];
	    for (var i = 0; i < this.views.length; i++) {
	        var viewGL = this.views[i];
	        if (viewGL.containPoint(x, y)) {
	            this._picking.scene = viewGL.scene;
	            this._picking.camera = viewGL.camera;
	            this._picking.pickAll(x, y, output);
	        }
	    }
	    output.sort(function (a, b) {
	        return a.distance - b.distance;
	    })
	    return output[0];
	};

	LayerGL.prototype._dispatchEvent = function (eveName, e, obj) {
	    var current = obj.target;
	    obj.cancelBubble = false;
	    obj.event = e;
	    obj.type = eveName;
	    while (current) {
	        current.trigger(eveName, obj);
	        current = current.getParent();

	        if (obj.cancelBubble) {
	            break;
	        }
	    }
	};

	zrUtil.inherits(LayerGL, Eventful);

	module.exports = LayerGL;

/***/ },
/* 5 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	// TODO Resources like shader, texture, geometry reference management
	// Trace and find out which shader, texture, geometry can be destroyed
	//
	// TODO prez skinning


	    var Base = __webpack_require__(6);
	    var glinfo = __webpack_require__(10);
	    var glenum = __webpack_require__(11);
	    var vendor = __webpack_require__(12);
	    var BoundingBox = __webpack_require__(13);
	    var Matrix4 = __webpack_require__(16);
	    var shaderLibrary = __webpack_require__(17);
	    var Material = __webpack_require__(20);
	    var Vector2 = __webpack_require__(22);

	    // Light header
	    var Shader = __webpack_require__(18);
	    Shader['import'](__webpack_require__(23));

	    var glMatrix = __webpack_require__(15);
	    var mat4 = glMatrix.mat4;
	    var vec3 = glMatrix.vec3;

	    var mat4Create = mat4.create;

	    var glid = 0;

	    var errorShader = {};

	    /**
	     * @constructor qtek.Renderer
	     */
	    var Renderer = Base.extend(function () {
	        return /** @lends qtek.Renderer# */ {

	            /**
	             * @type {HTMLCanvasElement}
	             * @readonly
	             */
	            canvas: null,

	            /**
	             * Canvas width, set by resize method
	             * @type {number}
	             * @private
	             */
	            _width: 100,

	            /**
	             * Canvas width, set by resize method
	             * @type {number}
	             * @private
	             */
	            _height: 100,

	            /**
	             * Device pixel ratio, set by setDevicePixelRatio method
	             * Specially for high defination display
	             * @see http://www.khronos.org/webgl/wiki/HandlingHighDPI
	             * @type {number}
	             * @private
	             */
	            devicePixelRatio: window.devicePixelRatio || 1.0,

	            /**
	             * Clear color
	             * @type {number[]}
	             */
	            color: [0.0, 0.0, 0.0, 0.0],

	            /**
	             * Default:
	             *     _gl.COLOR_BUFFER_BIT | _gl.DEPTH_BUFFER_BIT | _gl.STENCIL_BUFFER_BIT
	             * @type {number}
	             */
	            clear: 17664,

	            // Settings when getting context
	            // http://www.khronos.org/registry/webgl/specs/latest/#2.4

	            /**
	             * If enable alpha, default true
	             * @type {boolean}
	             */
	            alpha: true,
	            /**
	             * If enable depth buffer, default true
	             * @type {boolean}
	             */
	            depth: true,
	            /**
	             * If enable stencil buffer, default false
	             * @type {boolean}
	             */
	            stencil: false,
	            /**
	             * If enable antialias, default true
	             * @type {boolean}
	             */
	            antialias: true,
	            /**
	             * If enable premultiplied alpha, default true
	             * @type {boolean}
	             */
	            premultipliedAlpha: true,
	            /**
	             * If preserve drawing buffer, default false
	             * @type {boolean}
	             */
	            preserveDrawingBuffer: false,
	            /**
	             * If throw context error, usually turned on in debug mode
	             * @type {boolean}
	             */
	            throwError: true,
	            /**
	             * WebGL Context created from given canvas
	             * @type {WebGLRenderingContext}
	             */
	            gl: null,
	            /**
	             * Renderer viewport, read-only, can be set by setViewport method
	             * @type {Object}
	             */
	            viewport: {},

	            // Set by FrameBuffer#bind
	            __currentFrameBuffer: null,

	            _viewportStack: [],
	            _clearStack: [],

	            _sceneRendering: null
	        };
	    }, function () {

	        if (!this.canvas) {
	            this.canvas = document.createElement('canvas');
	        }
	        var canvas = this.canvas;
	        try {
	            var opts = {
	                alpha: this.alpha,
	                depth: this.depth,
	                stencil: this.stencil,
	                antialias: this.antialias,
	                premultipliedAlpha: this.premultipliedAlpha,
	                preserveDrawingBuffer: this.preserveDrawingBuffer
	            };

	            this.gl = canvas.getContext('webgl', opts)
	                || canvas.getContext('experimental-webgl', opts);

	            if (!this.gl) {
	                throw new Error();
	            }

	            if (this.gl.__GLID__ == null) {
	                // gl context is not created
	                // Otherwise is the case mutiple renderer share the same gl context
	                this.gl.__GLID__ = glid++;

	                glinfo.initialize(this.gl);
	            }

	            this.resize();
	        }
	        catch(e) {
	            throw 'Error creating WebGL Context ' + e;
	        }
	    },
	    /** @lends qtek.Renderer.prototype. **/
	    {
	        /**
	         * Resize the canvas
	         * @param {number} width
	         * @param {number} height
	         */
	        resize: function(width, height) {
	            var canvas = this.canvas;
	            // http://www.khronos.org/webgl/wiki/HandlingHighDPI
	            // set the display size of the canvas.
	            var dpr = this.devicePixelRatio;
	            if (width != null) {
	                canvas.style.width = width + 'px';
	                canvas.style.height = height + 'px';
	                // set the size of the drawingBuffer
	                canvas.width = width * dpr;
	                canvas.height = height * dpr;

	                this._width = width;
	                this._height = height;
	            }
	            else {
	                this._width = canvas.width / dpr;
	                this._height = canvas.height / dpr;
	            }

	            this.setViewport(0, 0, this._width, this._height);
	        },

	        /**
	         * Get renderer width
	         * @return {number}
	         */
	        getWidth: function () {
	            return this._width;
	        },

	        /**
	         * Get renderer height
	         * @return {number}
	         */
	        getHeight: function () {
	            return this._height;
	        },

	        /**
	         * Get viewport aspect,
	         */
	        getViewportAspect: function () {
	            var viewport = this.viewport;
	            return viewport.width / viewport.height;
	        },

	        /**
	         * Set devicePixelRatio
	         * @param {number} devicePixelRatio
	         */
	        setDevicePixelRatio: function(devicePixelRatio) {
	            this.devicePixelRatio = devicePixelRatio;
	            this.resize(this._width, this._height);
	        },

	        /**
	         * Get devicePixelRatio
	         * @param {number} devicePixelRatio
	         */
	        getDevicePixelRatio: function () {
	            return this.devicePixelRatio;
	        },

	        /**
	         * Get WebGL extionsion
	         * @return {object}
	         */
	        getExtension: function (name) {
	            return glinfo.getExtension(this.gl, name);
	        },

	        /**
	         * Set rendering viewport
	         * @param {number|Object} x
	         * @param {number} [y]
	         * @param {number} [width]
	         * @param {number} [height]
	         * @param {number} [devicePixelRatio]
	         *        Defaultly use the renderere devicePixelRatio
	         *        It needs to be 1 when setViewport is called by frameBuffer
	         *
	         * @example
	         *  setViewport(0,0,width,height,1)
	         *  setViewport({
	         *      x: 0,
	         *      y: 0,
	         *      width: width,
	         *      height: height,
	         *      devicePixelRatio: 1
	         *  })
	         */
	        setViewport: function (x, y, width, height, dpr) {

	            if (typeof x === 'object') {
	                var obj = x;

	                x = obj.x;
	                y = obj.y;
	                width = obj.width;
	                height = obj.height;
	                dpr = obj.devicePixelRatio;
	            }
	            dpr = dpr || this.devicePixelRatio;

	            this.gl.viewport(
	                x * dpr, y * dpr, width * dpr, height * dpr
	            );

	            this.viewport = {
	                x: x,
	                y: y,
	                width: width,
	                height: height,
	                devicePixelRatio: dpr
	            };
	        },

	        /**
	         * Push current viewport into a stack
	         */
	        saveViewport: function () {
	            this._viewportStack.push(this.viewport);
	        },

	        /**
	         * Pop viewport from stack, restore in the renderer
	         */
	        restoreViewport: function () {
	            if (this._viewportStack.length > 0) {
	                this.setViewport(this._viewportStack.pop());
	            }
	        },

	        /**
	         * Push current clear into a stack
	         */
	        saveClear: function () {
	            this._clearStack.push(this.clear);
	        },

	        /**
	         * Pop clear from stack, restore in the renderer
	         */
	        restoreClear: function () {
	            if (this._clearStack.length > 0) {
	                this.clear = this._clearStack.pop();
	            }
	        },

	        bindSceneRendering: function (scene) {
	            this._sceneRendering = scene;
	        },

	        // Hook before and after render each object
	        beforeRenderObject: function () {},
	        afterRenderObject: function () {},
	        /**
	         * Render the scene in camera to the screen or binded offline framebuffer
	         * @param  {qtek.Scene}       scene
	         * @param  {qtek.Camera}      camera
	         * @param  {boolean}     [notUpdateScene] If not call the scene.update methods in the rendering, default true
	         * @param  {boolean}     [preZ]           If use preZ optimization, default false
	         * @return {IRenderInfo}
	         */
	        render: function(scene, camera, notUpdateScene, preZ) {
	            var _gl = this.gl;

	            this._sceneRendering = scene;

	            var color = this.color;

	            if (this.clear) {

	                // Must set depth and color mask true before clear
	                _gl.colorMask(true, true, true, true);
	                _gl.depthMask(true);
	                var viewport = this.viewport;
	                var needsScissor = false;
	                var viewportDpr = viewport.devicePixelRatio;
	                if (viewport.width !== this._width || viewport.height !== this._height
	                    || viewportDpr && viewportDpr !== this.devicePixelRatio
	                    || viewport.x || viewport.y
	                ) {
	                    needsScissor = true;
	                    // http://stackoverflow.com/questions/11544608/how-to-clear-a-rectangle-area-in-webgl
	                    // Only clear the viewport
	                    _gl.enable(_gl.SCISSOR_TEST);
	                    _gl.scissor(viewport.x * viewportDpr, viewport.y * viewportDpr, viewport.width * viewportDpr, viewport.height * viewportDpr);
	                }
	                _gl.clearColor(color[0], color[1], color[2], color[3]);
	                _gl.clear(this.clear);
	                if (needsScissor) {
	                    _gl.disable(_gl.SCISSOR_TEST);
	                }
	            }

	            // If the scene have been updated in the prepass like shadow map
	            // There is no need to update it again
	            if (!notUpdateScene) {
	                scene.update(false);
	            }
	            // Update if camera not mounted on the scene
	            if (!camera.getScene()) {
	                camera.update(true);
	            }

	            var opaqueQueue = scene.opaqueQueue;
	            var transparentQueue = scene.transparentQueue;
	            var sceneMaterial = scene.material;

	            scene.trigger('beforerender', this, scene, camera);
	            // Sort render queue
	            // Calculate the object depth
	            if (transparentQueue.length > 0) {
	                var worldViewMat = mat4Create();
	                var posViewSpace = vec3.create();
	                for (var i = 0; i < transparentQueue.length; i++) {
	                    var node = transparentQueue[i];
	                    mat4.multiplyAffine(worldViewMat, camera.viewMatrix._array, node.worldTransform._array);
	                    vec3.transformMat4(posViewSpace, node.position._array, worldViewMat);
	                    node.__depth = posViewSpace[2];
	                }
	            }
	            opaqueQueue.sort(this.opaqueSortFunc);
	            transparentQueue.sort(this.transparentSortFunc);

	            // Render Opaque queue
	            scene.trigger('beforerender:opaque', this, opaqueQueue);

	            // Reset the scene bounding box;
	            scene.viewBoundingBoxLastFrame.min.set(Infinity, Infinity, Infinity);
	            scene.viewBoundingBoxLastFrame.max.set(-Infinity, -Infinity, -Infinity);

	            _gl.disable(_gl.BLEND);
	            _gl.enable(_gl.DEPTH_TEST);
	            var opaqueRenderInfo = this.renderQueue(opaqueQueue, camera, sceneMaterial, preZ);

	            scene.trigger('afterrender:opaque', this, opaqueQueue, opaqueRenderInfo);
	            scene.trigger('beforerender:transparent', this, transparentQueue);

	            // Render Transparent Queue
	            _gl.enable(_gl.BLEND);
	            var transparentRenderInfo = this.renderQueue(transparentQueue, camera, sceneMaterial);

	            scene.trigger('afterrender:transparent', this, transparentQueue, transparentRenderInfo);
	            var renderInfo = {};
	            for (var name in opaqueRenderInfo) {
	                renderInfo[name] = opaqueRenderInfo[name] + transparentRenderInfo[name];
	            }

	            scene.trigger('afterrender', this, scene, camera, renderInfo);

	            // Cleanup
	            this._sceneRendering = null;
	            return renderInfo;
	        },

	        /**
	         * Render a single renderable list in camera in sequence
	         * @param  {qtek.Renderable[]} queue       List of all renderables.
	         *                                         Best to be sorted by Renderer.opaqueSortFunc or Renderer.transparentSortFunc
	         * @param  {qtek.Camera}       camera
	         * @param  {qtek.Material}     [globalMaterial] globalMaterial will override the material of each renderable
	         * @param  {boolean}           [preZ]           If use preZ optimization, default false
	         * @return {IRenderInfo}
	         */
	        renderQueue: function(queue, camera, globalMaterial, preZ) {
	            var renderInfo = {
	                faceCount: 0,
	                vertexCount: 0,
	                drawCallCount: 0,
	                meshCount: queue.length,
	                renderedMeshCount: 0
	            };

	            // Some common builtin uniforms
	            var viewport = this.viewport;
	            var vDpr = viewport.devicePixelRatio;
	            var viewportUniform = [
	                viewport.x * vDpr, viewport.y * vDpr,
	                viewport.width * vDpr, viewport.height * vDpr
	            ];
	            var windowDpr = this.devicePixelRatio;
	            var windowSizeUniform = this.__currentFrameBuffer
	                ? [this.__currentFrameBuffer.getTextureWidth(), this.__currentFrameBuffer.getTextureHeight()]
	                : [this._width * windowDpr, this._height * windowDpr];
	            // DEPRECATED
	            var viewportSizeUniform = [
	                viewportUniform[2], viewportUniform[3]
	            ];


	            // Calculate view and projection matrix
	            mat4.copy(matrices.VIEW, camera.viewMatrix._array);
	            mat4.copy(matrices.PROJECTION, camera.projectionMatrix._array);
	            mat4.multiply(matrices.VIEWPROJECTION, camera.projectionMatrix._array, matrices.VIEW);
	            mat4.copy(matrices.VIEWINVERSE, camera.worldTransform._array);
	            mat4.invert(matrices.PROJECTIONINVERSE, matrices.PROJECTION);
	            mat4.invert(matrices.VIEWPROJECTIONINVERSE, matrices.VIEWPROJECTION);


	            var _gl = this.gl;
	            var scene = this._sceneRendering;

	            var prevMaterial;
	            var prevShader;

	            // Status
	            var depthTest, depthMask;
	            var culling, cullFace, frontFace;

	            var culledRenderQueue;
	            if (preZ) {
	                var preZPassMaterial = new Material({
	                    shader: shaderLibrary.get('qtek.prez')
	                });
	                var preZPassShader = preZPassMaterial.shader;

	                culledRenderQueue = [];
	                preZPassShader.bind(_gl);
	                _gl.colorMask(false, false, false, false);
	                _gl.depthMask(true);
	                _gl.enable(_gl.DEPTH_TEST);
	                for (var i = 0; i < queue.length; i++) {
	                    var renderable = queue[i];
	                    var worldM = renderable.worldTransform._array;
	                    var geometry = renderable.geometry;

	                    mat4.multiplyAffine(matrices.WORLDVIEW, matrices.VIEW , worldM);

	                    if (geometry.boundingBox) {
	                        if (this.isFrustumCulled(
	                            renderable, scene, camera, matrices.WORLDVIEW, matrices.PROJECTION
	                        )) {
	                            continue;
	                        }
	                    }
	                    if (renderable.skeleton) {  // FIXME  skinned mesh
	                        continue;
	                    }

	                    mat4.multiply(matrices.WORLDVIEWPROJECTION, matrices.VIEWPROJECTION , worldM);

	                    if (renderable.cullFace !== cullFace) {
	                        cullFace = renderable.cullFace;
	                        _gl.cullFace(cullFace);
	                    }
	                    if (renderable.frontFace !== frontFace) {
	                        frontFace = renderable.frontFace;
	                        _gl.frontFace(frontFace);
	                    }
	                    if (renderable.culling !== culling) {
	                        culling = renderable.culling;
	                        culling ? _gl.enable(_gl.CULL_FACE) : _gl.disable(_gl.CULL_FACE);
	                    }

	                    var semanticInfo = preZPassShader.matrixSemantics.WORLDVIEWPROJECTION;
	                    preZPassShader.setUniform(_gl, semanticInfo.type, semanticInfo.symbol, matrices.WORLDVIEWPROJECTION);

	                    // PENDING If invoke beforeRender hook
	                    renderable.render(_gl, preZPassMaterial);
	                    culledRenderQueue.push(renderable);
	                }
	                _gl.depthFunc(_gl.LEQUAL);
	                _gl.colorMask(true, true, true, true);
	                _gl.depthMask(false);
	            }
	            else {
	                culledRenderQueue = queue;
	            }

	            culling = null;
	            cullFace = null;
	            frontFace = null;

	            for (var i =0; i < culledRenderQueue.length; i++) {
	                var renderable = culledRenderQueue[i];
	                var geometry = renderable.geometry;

	                var worldM = renderable.worldTransform._array;
	                // All matrices ralated to world matrix will be updated on demand;
	                mat4.multiplyAffine(matrices.WORLDVIEW, matrices.VIEW , worldM);
	                if (geometry.boundingBox && !preZ) {
	                    if (this.isFrustumCulled(
	                        renderable, scene, camera, matrices.WORLDVIEW, matrices.PROJECTION
	                    )) {
	                        continue;
	                    }
	                }

	                var material = globalMaterial || renderable.material;
	                // StandardMaterial needs updateShader method so shader can be created on demand.
	                if (material !== prevMaterial) {
	                    material.updateShader && material.updateShader(_gl);
	                }

	                var shader = material.shader;

	                mat4.copy(matrices.WORLD, worldM);
	                mat4.multiply(matrices.WORLDVIEWPROJECTION, matrices.VIEWPROJECTION , worldM);
	                if (shader.matrixSemantics.WORLDINVERSE ||
	                    shader.matrixSemantics.WORLDINVERSETRANSPOSE) {
	                    mat4.invert(matrices.WORLDINVERSE, worldM);
	                }
	                if (shader.matrixSemantics.WORLDVIEWINVERSE ||
	                    shader.matrixSemantics.WORLDVIEWINVERSETRANSPOSE) {
	                    mat4.invert(matrices.WORLDVIEWINVERSE, matrices.WORLDVIEW);
	                }
	                if (shader.matrixSemantics.WORLDVIEWPROJECTIONINVERSE ||
	                    shader.matrixSemantics.WORLDVIEWPROJECTIONINVERSETRANSPOSE) {
	                    mat4.invert(matrices.WORLDVIEWPROJECTIONINVERSE, matrices.WORLDVIEWPROJECTION);
	                }

	                // Before render hook
	                renderable.beforeRender(_gl);
	                this.beforeRenderObject(renderable, prevMaterial);

	                if (prevShader !== shader) {
	                    // Set lights number
	                    if (scene && scene.isShaderLightNumberChanged(shader)) {
	                        scene.setShaderLightNumber(shader);
	                    }
	                    var errMsg = shader.bind(_gl);
	                    if (errMsg) {

	                        if (errorShader[shader.__GUID__]) {
	                            continue;
	                        }
	                        errorShader[shader.__GUID__] = true;

	                        if (this.throwError) {
	                            throw new Error(errMsg);
	                        }
	                        else {
	                            this.trigger('error', errMsg);
	                        }
	                    }
	                    // Set some common uniforms
	                    shader.setUniformOfSemantic(_gl, 'VIEWPORT', viewportUniform);
	                    shader.setUniformOfSemantic(_gl, 'WINDOW_SIZE', windowSizeUniform);
	                    // DEPRECATED
	                    shader.setUniformOfSemantic(_gl, 'VIEWPORT_SIZE', viewportSizeUniform);

	                    // Set lights uniforms
	                    // TODO needs optimized
	                    if (scene) {
	                        scene.setLightUniforms(shader, _gl);
	                    }
	                    prevShader = shader;
	                }
	                if (prevMaterial !== material) {
	                    if (!preZ) {
	                        if (material.depthTest !== depthTest) {
	                            material.depthTest ?
	                                _gl.enable(_gl.DEPTH_TEST) :
	                                _gl.disable(_gl.DEPTH_TEST);
	                            depthTest = material.depthTest;
	                        }
	                        if (material.depthMask !== depthMask) {
	                            _gl.depthMask(material.depthMask);
	                            depthMask = material.depthMask;
	                        }
	                    }
	                    material.bind(_gl, prevMaterial);
	                    prevMaterial = material;

	                    // TODO cache blending
	                    if (material.transparent) {
	                        if (material.blend) {
	                            material.blend(_gl);
	                        }
	                        else {    // Default blend function
	                            _gl.blendEquationSeparate(_gl.FUNC_ADD, _gl.FUNC_ADD);
	                            _gl.blendFuncSeparate(_gl.SRC_ALPHA, _gl.ONE_MINUS_SRC_ALPHA, _gl.ONE, _gl.ONE_MINUS_SRC_ALPHA);
	                        }
	                    }
	                }

	                var matrixSemanticKeys = shader.matrixSemanticKeys;
	                for (var k = 0; k < matrixSemanticKeys.length; k++) {
	                    var semantic = matrixSemanticKeys[k];
	                    var semanticInfo = shader.matrixSemantics[semantic];
	                    var matrix = matrices[semantic];
	                    if (semanticInfo.isTranspose) {
	                        var matrixNoTranspose = matrices[semanticInfo.semanticNoTranspose];
	                        mat4.transpose(matrix, matrixNoTranspose);
	                    }
	                    shader.setUniform(_gl, semanticInfo.type, semanticInfo.symbol, matrix);
	                }

	                if (renderable.cullFace !== cullFace) {
	                    cullFace = renderable.cullFace;
	                    _gl.cullFace(cullFace);
	                }
	                if (renderable.frontFace !== frontFace) {
	                    frontFace = renderable.frontFace;
	                    _gl.frontFace(frontFace);
	                }
	                if (renderable.culling !== culling) {
	                    culling = renderable.culling;
	                    culling ? _gl.enable(_gl.CULL_FACE) : _gl.disable(_gl.CULL_FACE);
	                }

	                var objectRenderInfo = renderable.render(_gl, globalMaterial);


	                if (objectRenderInfo) {
	                    renderInfo.faceCount += objectRenderInfo.faceCount;
	                    renderInfo.vertexCount += objectRenderInfo.vertexCount;
	                    renderInfo.drawCallCount += objectRenderInfo.drawCallCount;
	                    renderInfo.renderedMeshCount ++;
	                }

	                // After render hook
	                this.afterRenderObject(renderable, objectRenderInfo);
	                renderable.afterRender(_gl, objectRenderInfo);
	            }

	            if (preZ) {
	                // default depth func
	                _gl.depthFunc(_gl.LESS);
	            }

	            return renderInfo;
	        },

	        /**
	         * If an scene object is culled by camera frustum
	         *
	         * Object can be a renderable or a light
	         *
	         * @param {qtek.Node} Scene object
	         * @param {qtek.Camera} camera
	         * @param {Array.<number>} worldViewMat represented with array
	         * @param {Array.<number>} projectionMat represented with array
	         */
	        isFrustumCulled: (function () {
	            // Frustum culling
	            // http://www.cse.chalmers.se/~uffe/vfc_bbox.pdf
	            var cullingBoundingBox = new BoundingBox();
	            var cullingMatrix = new Matrix4();
	            return function(object, scene, camera, worldViewMat, projectionMat) {
	                // Bounding box can be a property of object(like light) or renderable.geometry
	                var geoBBox = object.boundingBox || object.geometry.boundingBox;
	                cullingMatrix._array = worldViewMat;
	                cullingBoundingBox.copy(geoBBox);
	                cullingBoundingBox.applyTransform(cullingMatrix);

	                // Passingly update the scene bounding box
	                // FIXME exclude very large mesh like ground plane or terrain ?
	                // FIXME Only rendererable which cast shadow ?
	                if (scene && object.isRenderable() && object.castShadow) {
	                    scene.viewBoundingBoxLastFrame.union(cullingBoundingBox);
	                }

	                if (object.frustumCulling)  {
	                    if (!cullingBoundingBox.intersectBoundingBox(camera.frustum.boundingBox)) {
	                        return true;
	                    }

	                    cullingMatrix._array = projectionMat;
	                    if (
	                        cullingBoundingBox.max._array[2] > 0 &&
	                        cullingBoundingBox.min._array[2] < 0
	                    ) {
	                        // Clip in the near plane
	                        cullingBoundingBox.max._array[2] = -1e-20;
	                    }

	                    cullingBoundingBox.applyProjection(cullingMatrix);

	                    var min = cullingBoundingBox.min._array;
	                    var max = cullingBoundingBox.max._array;

	                    if (
	                        max[0] < -1 || min[0] > 1
	                        || max[1] < -1 || min[1] > 1
	                        || max[2] < -1 || min[2] > 1
	                    ) {
	                        return true;
	                    }
	                }

	                return false;
	            };
	        })(),

	        /**
	         * Dispose given scene, including all geometris, textures and shaders in the scene
	         * @param {qtek.Scene} scene
	         */
	        disposeScene: function(scene) {
	            this.disposeNode(scene, true, true);
	            scene.dispose();
	        },

	        /**
	         * Dispose given node, including all geometries, textures and shaders attached on it or its descendant
	         * @param {qtek.Node} node
	         * @param {boolean} [disposeGeometry=false] If dispose the geometries used in the descendant mesh
	         * @param {boolean} [disposeTexture=false] If dispose the textures used in the descendant mesh
	         */
	        disposeNode: function(root, disposeGeometry, disposeTexture) {
	            var materials = {};
	            var _gl = this.gl;
	            // Dettached from parent
	            if (root.getParent()) {
	                root.getParent().remove(root);
	            }
	            root.traverse(function(node) {
	                if (node.geometry && disposeGeometry) {
	                    node.geometry.dispose(_gl);
	                }
	                if (node.material) {
	                    materials[node.material.__GUID__] = node.material;
	                }
	                // Particle system and AmbientCubemap light need to dispose
	                if (node.dispose) {
	                    node.dispose(_gl);
	                }
	            });
	            for (var guid in materials) {
	                var mat = materials[guid];
	                mat.dispose(_gl, disposeTexture);
	            }
	        },

	        /**
	         * Dispose given shader
	         * @param {qtek.Shader} shader
	         */
	        disposeShader: function(shader) {
	            shader.dispose(this.gl);
	        },

	        /**
	         * Dispose given geometry
	         * @param {qtek.Geometry} geometry
	         */
	        disposeGeometry: function(geometry) {
	            geometry.dispose(this.gl);
	        },

	        /**
	         * Dispose given texture
	         * @param {qtek.Texture} texture
	         */
	        disposeTexture: function(texture) {
	            texture.dispose(this.gl);
	        },

	        /**
	         * Dispose given frame buffer
	         * @param {qtek.FrameBuffer} frameBuffer
	         */
	        disposeFrameBuffer: function(frameBuffer) {
	            frameBuffer.dispose(this.gl);
	        },

	        /**
	         * Dispose renderer
	         */
	        dispose: function () {
	            glinfo.dispose(this.gl);
	        },

	        /**
	         * Convert screen coords to normalized device coordinates(NDC)
	         * Screen coords can get from mouse event, it is positioned relative to canvas element
	         * NDC can be used in ray casting with Camera.prototype.castRay methods
	         *
	         * @param  {number}       x
	         * @param  {number}       y
	         * @param  {qtek.math.Vector2} [out]
	         * @return {qtek.math.Vector2}
	         */
	        screenToNdc: function(x, y, out) {
	            if (!out) {
	                out = new Vector2();
	            }
	            // Invert y;
	            y = this._height - y;

	            var viewport = this.viewport;
	            var arr = out._array;
	            arr[0] = (x - viewport.x) / viewport.width;
	            arr[0] = arr[0] * 2 - 1;
	            arr[1] = (y - viewport.y) / viewport.height;
	            arr[1] = arr[1] * 2 - 1;

	            return out;
	        },
	    });

	    /**
	     * Opaque renderables compare function
	     * @param  {qtek.Renderable} x
	     * @param  {qtek.Renderable} y
	     * @return {boolean}
	     * @static
	     */
	    Renderer.opaqueSortFunc = Renderer.prototype.opaqueSortFunc = function(x, y) {
	        // Priority renderOrder -> shader -> material -> geometry
	        if (x.renderOrder === y.renderOrder) {
	            if (x.material.shader === y.material.shader) {
	                if (x.material === y.material) {
	                    return x.geometry.__GUID__ - y.geometry.__GUID__;
	                }
	                return x.material.__GUID__ - y.material.__GUID__;
	            }
	            return x.material.shader.__GUID__ - y.material.shader.__GUID__;
	        }
	        return x.renderOrder - y.renderOrder;
	    };

	    /**
	     * Transparent renderables compare function
	     * @param  {qtek.Renderable} a
	     * @param  {qtek.Renderable} b
	     * @return {boolean}
	     * @static
	     */
	    Renderer.transparentSortFunc = Renderer.prototype.transparentSortFunc = function(x, y) {
	        // Priority renderOrder -> depth -> shader -> material -> geometry

	        if (x.renderOrder === y.renderOrder) {
	            if (x.__depth === y.__depth) {
	                if (x.material.shader === y.material.shader) {
	                    if (x.material === y.material) {
	                        return x.geometry.__GUID__ - y.geometry.__GUID__;
	                    }
	                    return x.material.__GUID__ - y.material.__GUID__;
	                }
	                return x.material.shader.__GUID__ - y.material.shader.__GUID__;
	            }
	            // Depth is negative
	            // So farther object has smaller depth value
	            return x.__depth - y.__depth;
	        }
	        return x.renderOrder - y.renderOrder;
	    };

	    // Temporary variables
	    var matrices = {
	        WORLD: mat4Create(),
	        VIEW: mat4Create(),
	        PROJECTION: mat4Create(),
	        WORLDVIEW: mat4Create(),
	        VIEWPROJECTION: mat4Create(),
	        WORLDVIEWPROJECTION: mat4Create(),

	        WORLDINVERSE: mat4Create(),
	        VIEWINVERSE: mat4Create(),
	        PROJECTIONINVERSE: mat4Create(),
	        WORLDVIEWINVERSE: mat4Create(),
	        VIEWPROJECTIONINVERSE: mat4Create(),
	        WORLDVIEWPROJECTIONINVERSE: mat4Create(),

	        WORLDTRANSPOSE: mat4Create(),
	        VIEWTRANSPOSE: mat4Create(),
	        PROJECTIONTRANSPOSE: mat4Create(),
	        WORLDVIEWTRANSPOSE: mat4Create(),
	        VIEWPROJECTIONTRANSPOSE: mat4Create(),
	        WORLDVIEWPROJECTIONTRANSPOSE: mat4Create(),
	        WORLDINVERSETRANSPOSE: mat4Create(),
	        VIEWINVERSETRANSPOSE: mat4Create(),
	        PROJECTIONINVERSETRANSPOSE: mat4Create(),
	        WORLDVIEWINVERSETRANSPOSE: mat4Create(),
	        VIEWPROJECTIONINVERSETRANSPOSE: mat4Create(),
	        WORLDVIEWPROJECTIONINVERSETRANSPOSE: mat4Create()
	    };

	    Renderer.COLOR_BUFFER_BIT = glenum.COLOR_BUFFER_BIT;
	    Renderer.DEPTH_BUFFER_BIT = glenum.DEPTH_BUFFER_BIT;
	    Renderer.STENCIL_BUFFER_BIT = glenum.STENCIL_BUFFER_BIT;

	    module.exports = Renderer;


/***/ },
/* 6 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';


	    var extendMixin = __webpack_require__(7);
	    var notifierMixin = __webpack_require__(8);
	    var util = __webpack_require__(9);

	    /**
	     * Base class of all objects
	     * @constructor
	     * @alias qtek.core.Base
	     * @mixes qtek.core.mixin.notifier
	     */
	    var Base = function () {
	        /**
	         * @type {number}
	         */
	        this.__GUID__ = util.genGUID();
	    };

	    Base.__initializers__ = [
	        function (opts) {
	            util.extend(this, opts);
	        }
	    ];

	    util.extend(Base, extendMixin);
	    util.extend(Base.prototype, notifierMixin);

	    module.exports = Base;


/***/ },
/* 7 */
/***/ function(module, exports) {

	'use strict';


	    /**
	     * Extend a sub class from base class
	     * @param {object|Function} makeDefaultOpt default option of this sub class, method of the sub can use this.xxx to access this option
	     * @param {Function} [initialize] Initialize after the sub class is instantiated
	     * @param {Object} [proto] Prototype methods/properties of the sub class
	     * @memberOf qtek.core.mixin.extend
	     * @return {Function}
	     */
	    function derive(makeDefaultOpt, initialize/*optional*/, proto/*optional*/) {

	        if (typeof initialize == 'object') {
	            proto = initialize;
	            initialize = null;
	        }

	        var _super = this;

	        var propList;
	        if (!(makeDefaultOpt instanceof Function)) {
	            // Optimize the property iterate if it have been fixed
	            propList = [];
	            for (var propName in makeDefaultOpt) {
	                if (makeDefaultOpt.hasOwnProperty(propName)) {
	                    propList.push(propName);
	                }
	            }
	        }

	        var sub = function(options) {

	            // call super constructor
	            _super.apply(this, arguments);

	            if (makeDefaultOpt instanceof Function) {
	                // Invoke makeDefaultOpt each time if it is a function, So we can make sure each
	                // property in the object will not be shared by mutiple instances
	                extend(this, makeDefaultOpt.call(this, options));
	            }
	            else {
	                extendWithPropList(this, makeDefaultOpt, propList);
	            }

	            if (this.constructor === sub) {
	                // Initialize function will be called in the order of inherit
	                var initializers = sub.__initializers__;
	                for (var i = 0; i < initializers.length; i++) {
	                    initializers[i].apply(this, arguments);
	                }
	            }
	        };
	        // save super constructor
	        sub.__super__ = _super;
	        // Initialize function will be called after all the super constructor is called
	        if (!_super.__initializers__) {
	            sub.__initializers__ = [];
	        } else {
	            sub.__initializers__ = _super.__initializers__.slice();
	        }
	        if (initialize) {
	            sub.__initializers__.push(initialize);
	        }

	        var Ctor = function() {};
	        Ctor.prototype = _super.prototype;
	        sub.prototype = new Ctor();
	        sub.prototype.constructor = sub;
	        extend(sub.prototype, proto);

	        // extend the derive method as a static method;
	        sub.extend = _super.extend;

	        // DEPCRATED
	        sub.derive = _super.extend;

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

	    /**
	     * @alias qtek.core.mixin.extend
	     * @mixin
	     */
	    module.exports = {

	        extend: derive,

	        // DEPCRATED
	        derive: derive
	    };


/***/ },
/* 8 */
/***/ function(module, exports) {

	

	    function Handler(action, context) {
	        this.action = action;
	        this.context = context;
	    }
	    /**
	     * @mixin
	     * @alias qtek.core.mixin.notifier
	     */
	    var notifier = {
	        /**
	         * Trigger event
	         * @param  {string} name
	         */
	        trigger: function(name) {
	            if (!this.hasOwnProperty('__handlers__')) {
	                return;
	            }
	            if (!this.__handlers__.hasOwnProperty(name)) {
	                return;
	            }

	            var hdls = this.__handlers__[name];
	            var l = hdls.length, i = -1, args = arguments;
	            // Optimize advise from backbone
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
	        /**
	         * Register event handler
	         * @param  {string} name
	         * @param  {Function} action
	         * @param  {Object} [context]
	         * @chainable
	         */
	        on: function(name, action, context) {
	            if (!name || !action) {
	                return;
	            }
	            var handlers = this.__handlers__ || (this.__handlers__={});
	            if (!handlers[name]) {
	                handlers[name] = [];
	            }
	            else {
	                if (this.has(name, action)) {
	                    return;
	                }
	            }
	            var handler = new Handler(action, context || this);
	            handlers[name].push(handler);

	            return this;
	        },

	        /**
	         * Register event, event will only be triggered once and then removed
	         * @param  {string} name
	         * @param  {Function} action
	         * @param  {Object} [context]
	         * @chainable
	         */
	        once: function(name, action, context) {
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

	        /**
	         * Alias of once('before' + name)
	         * @param  {string} name
	         * @param  {Function} action
	         * @param  {Object} [context]
	         * @chainable
	         */
	        before: function(name, action, context) {
	            if (!name || !action) {
	                return;
	            }
	            name = 'before' + name;
	            return this.on(name, action, context);
	        },

	        /**
	         * Alias of once('after' + name)
	         * @param  {string} name
	         * @param  {Function} action
	         * @param  {Object} [context]
	         * @chainable
	         */
	        after: function(name, action, context) {
	            if (!name || !action) {
	                return;
	            }
	            name = 'after' + name;
	            return this.on(name, action, context);
	        },

	        /**
	         * Alias of on('success')
	         * @param  {Function} action
	         * @param  {Object} [context]
	         * @chainable
	         */
	        success: function(action, context) {
	            return this.once('success', action, context);
	        },

	        /**
	         * Alias of on('error')
	         * @param  {Function} action
	         * @param  {Object} [context]
	         * @chainable
	         */
	        error: function(action, context) {
	            return this.once('error', action, context);
	        },

	        /**
	         * Alias of on('success')
	         * @param  {Function} action
	         * @param  {Object} [context]
	         * @chainable
	         */
	        off: function(name, action) {

	            var handlers = this.__handlers__ || (this.__handlers__={});

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

	        /**
	         * If registered the event handler
	         * @param  {string}  name
	         * @param  {Function}  action
	         * @return {boolean}
	         */
	        has: function(name, action) {
	            var handlers = this.__handlers__;

	            if (! handlers ||
	                ! handlers[name]) {
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

	    module.exports = notifier;


/***/ },
/* 9 */
/***/ function(module, exports) {

	'use strict';


	    var guid = 0;

	    var ArrayProto = Array.prototype;
	    var nativeForEach = ArrayProto.forEach;

	    /**
	     * Util functions
	     * @namespace qtek.core.util
	     */
		var util = {

	        /**
	         * Generate GUID
	         * @return {number}
	         * @memberOf qtek.core.util
	         */
			genGUID: function() {
				return ++guid;
			},
	        /**
	         * Relative path to absolute path
	         * @param  {string} path
	         * @param  {string} basePath
	         * @return {string}
	         * @memberOf qtek.core.util
	         */
	        relative2absolute: function(path, basePath) {
	            if (!basePath || path.match(/^\//)) {
	                return path;
	            }
	            var pathParts = path.split('/');
	            var basePathParts = basePath.split('/');

	            var item = pathParts[0];
	            while(item === '.' || item === '..') {
	                if (item === '..') {
	                    basePathParts.pop();
	                }
	                pathParts.shift();
	                item = pathParts[0];
	            }
	            return basePathParts.join('/') + '/' + pathParts.join('/');
	        },

	        /**
	         * Extend target with source
	         * @param  {Object} target
	         * @param  {Object} source
	         * @return {Object}
	         * @memberOf qtek.core.util
	         */
	        extend: function(target, source) {
	            if (source) {
	                for (var name in source) {
	                    if (source.hasOwnProperty(name)) {
	                        target[name] = source[name];
	                    }
	                }
	            }
	            return target;
	        },

	        /**
	         * Extend properties to target if not exist.
	         * @param  {Object} target
	         * @param  {Object} source
	         * @return {Object}
	         * @memberOf qtek.core.util
	         */
	        defaults: function(target, source) {
	            if (source) {
	                for (var propName in source) {
	                    if (target[propName] === undefined) {
	                        target[propName] = source[propName];
	                    }
	                }
	            }
	            return target;
	        },
	        /**
	         * Extend properties with a given property list to avoid for..in.. iteration.
	         * @param  {Object} target
	         * @param  {Object} source
	         * @param  {Array.<string>} propList
	         * @return {Object}
	         * @memberOf qtek.core.util
	         */
	        extendWithPropList: function(target, source, propList) {
	            if (source) {
	                for (var i = 0; i < propList.length; i++) {
	                    var propName = propList[i];
	                    target[propName] = source[propName];
	                }
	            }
	            return target;
	        },
	        /**
	         * Extend properties to target if not exist. With a given property list avoid for..in.. iteration.
	         * @param  {Object} target
	         * @param  {Object} source
	         * @param  {Array.<string>} propList
	         * @return {Object}
	         * @memberOf qtek.core.util
	         */
	        defaultsWithPropList: function(target, source, propList) {
	            if (source) {
	                for (var i = 0; i < propList.length; i++) {
	                    var propName = propList[i];
	                    if (target[propName] == null) {
	                        target[propName] = source[propName];
	                    }
	                }
	            }
	            return target;
	        },
	        /**
	         * @param  {Object|Array} obj
	         * @param  {Function} iterator
	         * @param  {Object} [context]
	         * @memberOf qtek.core.util
	         */
	        each: function(obj, iterator, context) {
	            if (!(obj && iterator)) {
	                return;
	            }
	            if (obj.forEach && obj.forEach === nativeForEach) {
	                obj.forEach(iterator, context);
	            } else if (obj.length === + obj.length) {
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

	        /**
	         * Is object ?
	         * @param  {}  obj
	         * @return {boolean}
	         * @memberOf qtek.core.util
	         */
	        isObject: function(obj) {
	            return obj === Object(obj);
	        },

	        /**
	         * Is array ?
	         * @param  {}  obj
	         * @return {boolean}
	         * @memberOf qtek.core.util
	         */
	        isArray: function(obj) {
	            return obj instanceof Array;
	        },

	        /**
	         * Is array like, which have a length property
	         * @param  {}  obj
	         * @return {boolean}
	         * @memberOf qtek.core.util
	         */
	        isArrayLike: function(obj) {
	            if (!obj) {
	                return false;
	            } else {
	                return obj.length === + obj.length;
	            }
	        },

	        /**
	         * @param  {} obj
	         * @return {}
	         * @memberOf qtek.core.util
	         */
	        clone: function(obj) {
	            if (!util.isObject(obj)) {
	                return obj;
	            } else if (util.isArray(obj)) {
	                return obj.slice();
	            } else if (util.isArrayLike(obj)) { // is typed array
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

	    module.exports = util;


/***/ },
/* 10 */
/***/ function(module, exports) {

	'use strict';
	/**
	 * @namespace qtek.core.glinfo
	 * @see http://www.khronos.org/registry/webgl/extensions/
	 */


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
	        'WEBGL_draw_buffers',
	        'EXT_frag_depth'
	    ];

	    var PARAMETER_NAMES = [
	        'MAX_TEXTURE_SIZE',
	        'MAX_CUBE_MAP_TEXTURE_SIZE'
	    ];

	    var extensions = {};
	    var parameters = {};

	    var glinfo = {
	        /**
	         * Initialize all extensions and parameters in context
	         * @param  {WebGLRenderingContext} _gl
	         * @memberOf qtek.core.glinfo
	         */
	        initialize: function (_gl) {
	            var glid = _gl.__GLID__;
	            if (extensions[glid]) {
	                return;
	            }
	            extensions[glid] = {};
	            parameters[glid] = {};
	            // Get webgl extension
	            for (var i = 0; i < EXTENSION_LIST.length; i++) {
	                var extName = EXTENSION_LIST[i];

	                this._createExtension(_gl, extName);
	            }
	            // Get parameters
	            for (var i = 0; i < PARAMETER_NAMES.length; i++) {
	                var name = PARAMETER_NAMES[i];
	                parameters[glid][name] = _gl.getParameter(_gl[name]);
	            }
	        },

	        /**
	         * Get extension
	         * @param  {WebGLRenderingContext} _gl
	         * @param {string} name - Extension name, vendorless
	         * @return {WebGLExtension}
	         * @memberOf qtek.core.glinfo
	         */
	        getExtension: function (_gl, name) {
	            var glid = _gl.__GLID__;
	            if (extensions[glid]) {
	                if (typeof(extensions[glid][name]) == 'undefined') {
	                    this._createExtension(_gl, name);
	                }
	                return extensions[glid][name];
	            }
	        },

	        /**
	         * Get parameter
	         * @param {WebGLRenderingContext} _gl
	         * @param {string} name Parameter name
	         * @return {*}
	         */
	        getParameter: function (_gl, name) {
	            var glid = _gl.__GLID__;
	            if (parameters[glid]) {
	                return parameters[glid][name];
	            }
	        },

	        /**
	         * Dispose context
	         * @param  {WebGLRenderingContext} _gl
	         * @memberOf qtek.core.glinfo
	         */
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

	    module.exports = glinfo;


/***/ },
/* 11 */
/***/ function(module, exports) {

	/**
	 * @namespace qtek.core.glenum
	 * @see http://www.khronos.org/registry/webgl/specs/latest/1.0/#5.14
	 */


	module.exports = {
	    /* ClearBufferMask */
	    DEPTH_BUFFER_BIT               : 0x00000100,
	    STENCIL_BUFFER_BIT             : 0x00000400,
	    COLOR_BUFFER_BIT               : 0x00004000,
	    
	    /* BeginMode */
	    POINTS                         : 0x0000,
	    LINES                          : 0x0001,
	    LINE_LOOP                      : 0x0002,
	    LINE_STRIP                     : 0x0003,
	    TRIANGLES                      : 0x0004,
	    TRIANGLE_STRIP                 : 0x0005,
	    TRIANGLE_FAN                   : 0x0006,
	    
	    /* AlphaFunction (not supported in ES20) */
	    /*      NEVER */
	    /*      LESS */
	    /*      EQUAL */
	    /*      LEQUAL */
	    /*      GREATER */
	    /*      NOTEQUAL */
	    /*      GEQUAL */
	    /*      ALWAYS */
	    
	    /* BlendingFactorDest */
	    ZERO                           : 0,
	    ONE                            : 1,
	    SRC_COLOR                      : 0x0300,
	    ONE_MINUS_SRC_COLOR            : 0x0301,
	    SRC_ALPHA                      : 0x0302,
	    ONE_MINUS_SRC_ALPHA            : 0x0303,
	    DST_ALPHA                      : 0x0304,
	    ONE_MINUS_DST_ALPHA            : 0x0305,
	    
	    /* BlendingFactorSrc */
	    /*      ZERO */
	    /*      ONE */
	    DST_COLOR                      : 0x0306,
	    ONE_MINUS_DST_COLOR            : 0x0307,
	    SRC_ALPHA_SATURATE             : 0x0308,
	    /*      SRC_ALPHA */
	    /*      ONE_MINUS_SRC_ALPHA */
	    /*      DST_ALPHA */
	    /*      ONE_MINUS_DST_ALPHA */
	    
	    /* BlendEquationSeparate */
	    FUNC_ADD                       : 0x8006,
	    BLEND_EQUATION                 : 0x8009,
	    BLEND_EQUATION_RGB             : 0x8009, /* same as BLEND_EQUATION */
	    BLEND_EQUATION_ALPHA           : 0x883D,
	    
	    /* BlendSubtract */
	    FUNC_SUBTRACT                  : 0x800A,
	    FUNC_REVERSE_SUBTRACT          : 0x800B,
	    
	    /* Separate Blend Functions */
	    BLEND_DST_RGB                  : 0x80C8,
	    BLEND_SRC_RGB                  : 0x80C9,
	    BLEND_DST_ALPHA                : 0x80CA,
	    BLEND_SRC_ALPHA                : 0x80CB,
	    CONSTANT_COLOR                 : 0x8001,
	    ONE_MINUS_CONSTANT_COLOR       : 0x8002,
	    CONSTANT_ALPHA                 : 0x8003,
	    ONE_MINUS_CONSTANT_ALPHA       : 0x8004,
	    BLEND_COLOR                    : 0x8005,
	    
	    /* Buffer Objects */
	    ARRAY_BUFFER                   : 0x8892,
	    ELEMENT_ARRAY_BUFFER           : 0x8893,
	    ARRAY_BUFFER_BINDING           : 0x8894,
	    ELEMENT_ARRAY_BUFFER_BINDING   : 0x8895,
	    
	    STREAM_DRAW                    : 0x88E0,
	    STATIC_DRAW                    : 0x88E4,
	    DYNAMIC_DRAW                   : 0x88E8,
	    
	    BUFFER_SIZE                    : 0x8764,
	    BUFFER_USAGE                   : 0x8765,
	    
	    CURRENT_VERTEX_ATTRIB          : 0x8626,
	    
	    /* CullFaceMode */
	    FRONT                          : 0x0404,
	    BACK                           : 0x0405,
	    FRONT_AND_BACK                 : 0x0408,
	    
	    /* DepthFunction */
	    /*      NEVER */
	    /*      LESS */
	    /*      EQUAL */
	    /*      LEQUAL */
	    /*      GREATER */
	    /*      NOTEQUAL */
	    /*      GEQUAL */
	    /*      ALWAYS */
	    
	    /* EnableCap */
	    /* TEXTURE_2D */
	    CULL_FACE                      : 0x0B44,
	    BLEND                          : 0x0BE2,
	    DITHER                         : 0x0BD0,
	    STENCIL_TEST                   : 0x0B90,
	    DEPTH_TEST                     : 0x0B71,
	    SCISSOR_TEST                   : 0x0C11,
	    POLYGON_OFFSET_FILL            : 0x8037,
	    SAMPLE_ALPHA_TO_COVERAGE       : 0x809E,
	    SAMPLE_COVERAGE                : 0x80A0,
	    
	    /* ErrorCode */
	    NO_ERROR                       : 0,
	    INVALID_ENUM                   : 0x0500,
	    INVALID_VALUE                  : 0x0501,
	    INVALID_OPERATION              : 0x0502,
	    OUT_OF_MEMORY                  : 0x0505,
	    
	    /* FrontFaceDirection */
	    CW                             : 0x0900,
	    CCW                            : 0x0901,
	    
	    /* GetPName */
	    LINE_WIDTH                     : 0x0B21,
	    ALIASED_POINT_SIZE_RANGE       : 0x846D,
	    ALIASED_LINE_WIDTH_RANGE       : 0x846E,
	    CULL_FACE_MODE                 : 0x0B45,
	    FRONT_FACE                     : 0x0B46,
	    DEPTH_RANGE                    : 0x0B70,
	    DEPTH_WRITEMASK                : 0x0B72,
	    DEPTH_CLEAR_VALUE              : 0x0B73,
	    DEPTH_FUNC                     : 0x0B74,
	    STENCIL_CLEAR_VALUE            : 0x0B91,
	    STENCIL_FUNC                   : 0x0B92,
	    STENCIL_FAIL                   : 0x0B94,
	    STENCIL_PASS_DEPTH_FAIL        : 0x0B95,
	    STENCIL_PASS_DEPTH_PASS        : 0x0B96,
	    STENCIL_REF                    : 0x0B97,
	    STENCIL_VALUE_MASK             : 0x0B93,
	    STENCIL_WRITEMASK              : 0x0B98,
	    STENCIL_BACK_FUNC              : 0x8800,
	    STENCIL_BACK_FAIL              : 0x8801,
	    STENCIL_BACK_PASS_DEPTH_FAIL   : 0x8802,
	    STENCIL_BACK_PASS_DEPTH_PASS   : 0x8803,
	    STENCIL_BACK_REF               : 0x8CA3,
	    STENCIL_BACK_VALUE_MASK        : 0x8CA4,
	    STENCIL_BACK_WRITEMASK         : 0x8CA5,
	    VIEWPORT                       : 0x0BA2,
	    SCISSOR_BOX                    : 0x0C10,
	    /*      SCISSOR_TEST */
	    COLOR_CLEAR_VALUE              : 0x0C22,
	    COLOR_WRITEMASK                : 0x0C23,
	    UNPACK_ALIGNMENT               : 0x0CF5,
	    PACK_ALIGNMENT                 : 0x0D05,
	    MAX_TEXTURE_SIZE               : 0x0D33,
	    MAX_VIEWPORT_DIMS              : 0x0D3A,
	    SUBPIXEL_BITS                  : 0x0D50,
	    RED_BITS                       : 0x0D52,
	    GREEN_BITS                     : 0x0D53,
	    BLUE_BITS                      : 0x0D54,
	    ALPHA_BITS                     : 0x0D55,
	    DEPTH_BITS                     : 0x0D56,
	    STENCIL_BITS                   : 0x0D57,
	    POLYGON_OFFSET_UNITS           : 0x2A00,
	    /*      POLYGON_OFFSET_FILL */
	    POLYGON_OFFSET_FACTOR          : 0x8038,
	    TEXTURE_BINDING_2D             : 0x8069,
	    SAMPLE_BUFFERS                 : 0x80A8,
	    SAMPLES                        : 0x80A9,
	    SAMPLE_COVERAGE_VALUE          : 0x80AA,
	    SAMPLE_COVERAGE_INVERT         : 0x80AB,
	    
	    /* GetTextureParameter */
	    /*      TEXTURE_MAG_FILTER */
	    /*      TEXTURE_MIN_FILTER */
	    /*      TEXTURE_WRAP_S */
	    /*      TEXTURE_WRAP_T */
	    
	    COMPRESSED_TEXTURE_FORMATS     : 0x86A3,
	    
	    /* HintMode */
	    DONT_CARE                      : 0x1100,
	    FASTEST                        : 0x1101,
	    NICEST                         : 0x1102,
	    
	    /* HintTarget */
	    GENERATE_MIPMAP_HINT            : 0x8192,
	    
	    /* DataType */
	    BYTE                           : 0x1400,
	    UNSIGNED_BYTE                  : 0x1401,
	    SHORT                          : 0x1402,
	    UNSIGNED_SHORT                 : 0x1403,
	    INT                            : 0x1404,
	    UNSIGNED_INT                   : 0x1405,
	    FLOAT                          : 0x1406,
	    
	    /* PixelFormat */
	    DEPTH_COMPONENT                : 0x1902,
	    ALPHA                          : 0x1906,
	    RGB                            : 0x1907,
	    RGBA                           : 0x1908,
	    LUMINANCE                      : 0x1909,
	    LUMINANCE_ALPHA                : 0x190A,
	    
	    /* PixelType */
	    /*      UNSIGNED_BYTE */
	    UNSIGNED_SHORT_4_4_4_4         : 0x8033,
	    UNSIGNED_SHORT_5_5_5_1         : 0x8034,
	    UNSIGNED_SHORT_5_6_5           : 0x8363,
	    
	    /* Shaders */
	    FRAGMENT_SHADER                  : 0x8B30,
	    VERTEX_SHADER                    : 0x8B31,
	    MAX_VERTEX_ATTRIBS               : 0x8869,
	    MAX_VERTEX_UNIFORM_VECTORS       : 0x8DFB,
	    MAX_VARYING_VECTORS              : 0x8DFC,
	    MAX_COMBINED_TEXTURE_IMAGE_UNITS : 0x8B4D,
	    MAX_VERTEX_TEXTURE_IMAGE_UNITS   : 0x8B4C,
	    MAX_TEXTURE_IMAGE_UNITS          : 0x8872,
	    MAX_FRAGMENT_UNIFORM_VECTORS     : 0x8DFD,
	    SHADER_TYPE                      : 0x8B4F,
	    DELETE_STATUS                    : 0x8B80,
	    LINK_STATUS                      : 0x8B82,
	    VALIDATE_STATUS                  : 0x8B83,
	    ATTACHED_SHADERS                 : 0x8B85,
	    ACTIVE_UNIFORMS                  : 0x8B86,
	    ACTIVE_ATTRIBUTES                : 0x8B89,
	    SHADING_LANGUAGE_VERSION         : 0x8B8C,
	    CURRENT_PROGRAM                  : 0x8B8D,
	    
	    /* StencilFunction */
	    NEVER                          : 0x0200,
	    LESS                           : 0x0201,
	    EQUAL                          : 0x0202,
	    LEQUAL                         : 0x0203,
	    GREATER                        : 0x0204,
	    NOTEQUAL                       : 0x0205,
	    GEQUAL                         : 0x0206,
	    ALWAYS                         : 0x0207,
	    
	    /* StencilOp */
	    /*      ZERO */
	    KEEP                           : 0x1E00,
	    REPLACE                        : 0x1E01,
	    INCR                           : 0x1E02,
	    DECR                           : 0x1E03,
	    INVERT                         : 0x150A,
	    INCR_WRAP                      : 0x8507,
	    DECR_WRAP                      : 0x8508,
	    
	    /* StringName */
	    VENDOR                         : 0x1F00,
	    RENDERER                       : 0x1F01,
	    VERSION                        : 0x1F02,
	    
	    /* TextureMagFilter */
	    NEAREST                        : 0x2600,
	    LINEAR                         : 0x2601,
	    
	    /* TextureMinFilter */
	    /*      NEAREST */
	    /*      LINEAR */
	    NEAREST_MIPMAP_NEAREST         : 0x2700,
	    LINEAR_MIPMAP_NEAREST          : 0x2701,
	    NEAREST_MIPMAP_LINEAR          : 0x2702,
	    LINEAR_MIPMAP_LINEAR           : 0x2703,
	    
	    /* TextureParameterName */
	    TEXTURE_MAG_FILTER             : 0x2800,
	    TEXTURE_MIN_FILTER             : 0x2801,
	    TEXTURE_WRAP_S                 : 0x2802,
	    TEXTURE_WRAP_T                 : 0x2803,
	    
	    /* TextureTarget */
	    TEXTURE_2D                     : 0x0DE1,
	    TEXTURE                        : 0x1702,
	    
	    TEXTURE_CUBE_MAP               : 0x8513,
	    TEXTURE_BINDING_CUBE_MAP       : 0x8514,
	    TEXTURE_CUBE_MAP_POSITIVE_X    : 0x8515,
	    TEXTURE_CUBE_MAP_NEGATIVE_X    : 0x8516,
	    TEXTURE_CUBE_MAP_POSITIVE_Y    : 0x8517,
	    TEXTURE_CUBE_MAP_NEGATIVE_Y    : 0x8518,
	    TEXTURE_CUBE_MAP_POSITIVE_Z    : 0x8519,
	    TEXTURE_CUBE_MAP_NEGATIVE_Z    : 0x851A,
	    MAX_CUBE_MAP_TEXTURE_SIZE      : 0x851C,
	    
	    /* TextureUnit */
	    TEXTURE0                       : 0x84C0,
	    TEXTURE1                       : 0x84C1,
	    TEXTURE2                       : 0x84C2,
	    TEXTURE3                       : 0x84C3,
	    TEXTURE4                       : 0x84C4,
	    TEXTURE5                       : 0x84C5,
	    TEXTURE6                       : 0x84C6,
	    TEXTURE7                       : 0x84C7,
	    TEXTURE8                       : 0x84C8,
	    TEXTURE9                       : 0x84C9,
	    TEXTURE10                      : 0x84CA,
	    TEXTURE11                      : 0x84CB,
	    TEXTURE12                      : 0x84CC,
	    TEXTURE13                      : 0x84CD,
	    TEXTURE14                      : 0x84CE,
	    TEXTURE15                      : 0x84CF,
	    TEXTURE16                      : 0x84D0,
	    TEXTURE17                      : 0x84D1,
	    TEXTURE18                      : 0x84D2,
	    TEXTURE19                      : 0x84D3,
	    TEXTURE20                      : 0x84D4,
	    TEXTURE21                      : 0x84D5,
	    TEXTURE22                      : 0x84D6,
	    TEXTURE23                      : 0x84D7,
	    TEXTURE24                      : 0x84D8,
	    TEXTURE25                      : 0x84D9,
	    TEXTURE26                      : 0x84DA,
	    TEXTURE27                      : 0x84DB,
	    TEXTURE28                      : 0x84DC,
	    TEXTURE29                      : 0x84DD,
	    TEXTURE30                      : 0x84DE,
	    TEXTURE31                      : 0x84DF,
	    ACTIVE_TEXTURE                 : 0x84E0,
	    
	    /* TextureWrapMode */
	    REPEAT                         : 0x2901,
	    CLAMP_TO_EDGE                  : 0x812F,
	    MIRRORED_REPEAT                : 0x8370,
	    
	    /* Uniform Types */
	    FLOAT_VEC2                     : 0x8B50,
	    FLOAT_VEC3                     : 0x8B51,
	    FLOAT_VEC4                     : 0x8B52,
	    INT_VEC2                       : 0x8B53,
	    INT_VEC3                       : 0x8B54,
	    INT_VEC4                       : 0x8B55,
	    BOOL                           : 0x8B56,
	    BOOL_VEC2                      : 0x8B57,
	    BOOL_VEC3                      : 0x8B58,
	    BOOL_VEC4                      : 0x8B59,
	    FLOAT_MAT2                     : 0x8B5A,
	    FLOAT_MAT3                     : 0x8B5B,
	    FLOAT_MAT4                     : 0x8B5C,
	    SAMPLER_2D                     : 0x8B5E,
	    SAMPLER_CUBE                   : 0x8B60,
	    
	    /* Vertex Arrays */
	    VERTEX_ATTRIB_ARRAY_ENABLED        : 0x8622,
	    VERTEX_ATTRIB_ARRAY_SIZE           : 0x8623,
	    VERTEX_ATTRIB_ARRAY_STRIDE         : 0x8624,
	    VERTEX_ATTRIB_ARRAY_TYPE           : 0x8625,
	    VERTEX_ATTRIB_ARRAY_NORMALIZED     : 0x886A,
	    VERTEX_ATTRIB_ARRAY_POINTER        : 0x8645,
	    VERTEX_ATTRIB_ARRAY_BUFFER_BINDING : 0x889F,
	    
	    /* Shader Source */
	    COMPILE_STATUS                 : 0x8B81,
	    
	    /* Shader Precision-Specified Types */
	    LOW_FLOAT                      : 0x8DF0,
	    MEDIUM_FLOAT                   : 0x8DF1,
	    HIGH_FLOAT                     : 0x8DF2,
	    LOW_INT                        : 0x8DF3,
	    MEDIUM_INT                     : 0x8DF4,
	    HIGH_INT                       : 0x8DF5,
	    
	    /* Framebuffer Object. */
	    FRAMEBUFFER                    : 0x8D40,
	    RENDERBUFFER                   : 0x8D41,
	    
	    RGBA4                          : 0x8056,
	    RGB5_A1                        : 0x8057,
	    RGB565                         : 0x8D62,
	    DEPTH_COMPONENT16              : 0x81A5,
	    STENCIL_INDEX                  : 0x1901,
	    STENCIL_INDEX8                 : 0x8D48,
	    DEPTH_STENCIL                  : 0x84F9,
	    
	    RENDERBUFFER_WIDTH             : 0x8D42,
	    RENDERBUFFER_HEIGHT            : 0x8D43,
	    RENDERBUFFER_INTERNAL_FORMAT   : 0x8D44,
	    RENDERBUFFER_RED_SIZE          : 0x8D50,
	    RENDERBUFFER_GREEN_SIZE        : 0x8D51,
	    RENDERBUFFER_BLUE_SIZE         : 0x8D52,
	    RENDERBUFFER_ALPHA_SIZE        : 0x8D53,
	    RENDERBUFFER_DEPTH_SIZE        : 0x8D54,
	    RENDERBUFFER_STENCIL_SIZE      : 0x8D55,
	    
	    FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE           : 0x8CD0,
	    FRAMEBUFFER_ATTACHMENT_OBJECT_NAME           : 0x8CD1,
	    FRAMEBUFFER_ATTACHMENT_TEXTURE_LEVEL         : 0x8CD2,
	    FRAMEBUFFER_ATTACHMENT_TEXTURE_CUBE_MAP_FACE : 0x8CD3,
	    
	    COLOR_ATTACHMENT0              : 0x8CE0,
	    DEPTH_ATTACHMENT               : 0x8D00,
	    STENCIL_ATTACHMENT             : 0x8D20,
	    DEPTH_STENCIL_ATTACHMENT       : 0x821A,
	    
	    NONE                           : 0,
	    
	    FRAMEBUFFER_COMPLETE                      : 0x8CD5,
	    FRAMEBUFFER_INCOMPLETE_ATTACHMENT         : 0x8CD6,
	    FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT : 0x8CD7,
	    FRAMEBUFFER_INCOMPLETE_DIMENSIONS         : 0x8CD9,
	    FRAMEBUFFER_UNSUPPORTED                   : 0x8CDD,
	    
	    FRAMEBUFFER_BINDING            : 0x8CA6,
	    RENDERBUFFER_BINDING           : 0x8CA7,
	    MAX_RENDERBUFFER_SIZE          : 0x84E8,
	    
	    INVALID_FRAMEBUFFER_OPERATION  : 0x0506,
	    
	    /* WebGL-specific enums */
	    UNPACK_FLIP_Y_WEBGL            : 0x9240,
	    UNPACK_PREMULTIPLY_ALPHA_WEBGL : 0x9241,
	    CONTEXT_LOST_WEBGL             : 0x9242,
	    UNPACK_COLORSPACE_CONVERSION_WEBGL : 0x9243,
	    BROWSER_DEFAULT_WEBGL          : 0x9244,
	};


/***/ },
/* 12 */
/***/ function(module, exports) {

	'use strict';


	    var supportWebGL = true;
	    try {
	        var canvas = document.createElement('canvas');
	        var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
	        if (!gl) {
	            throw new Error();
	        }
	    } catch (e) {
	        supportWebGL = false;
	    }

	    var vendor = {};

	    /**
	     * If support WebGL
	     * @return {boolean}
	     */
	    vendor.supportWebGL = function () {
	        return supportWebGL;
	    };


	    vendor.Int8Array = typeof Int8Array == 'undefined' ? Array : Int8Array;

	    vendor.Uint8Array = typeof Uint8Array == 'undefined' ? Array : Uint8Array;

	    vendor.Uint16Array = typeof Uint16Array == 'undefined' ? Array : Uint16Array;

	    vendor.Uint32Array = typeof Uint32Array == 'undefined' ? Array : Uint32Array;

	    vendor.Int16Array = typeof Int16Array == 'undefined' ? Array : Int16Array;

	    vendor.Float32Array = typeof Float32Array == 'undefined' ? Array : Float32Array;

	    vendor.Float64Array = typeof Float64Array == 'undefined' ? Array : Float64Array;

	    module.exports = vendor;


/***/ },
/* 13 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';


	    var Vector3 = __webpack_require__(14);
	    var glMatrix = __webpack_require__(15);
	    var vec3 = glMatrix.vec3;

	    var vec3Copy = vec3.copy;
	    var vec3Set = vec3.set;

	    /**
	     * Axis aligned bounding box
	     * @constructor
	     * @alias qtek.math.BoundingBox
	     * @param {qtek.math.Vector3} [min]
	     * @param {qtek.math.Vector3} [max]
	     */
	    var BoundingBox = function (min, max) {

	        /**
	         * Minimum coords of bounding box
	         * @type {qtek.math.Vector3}
	         */
	        this.min = min || new Vector3(Infinity, Infinity, Infinity);

	        /**
	         * Maximum coords of bounding box
	         * @type {qtek.math.Vector3}
	         */
	        this.max = max || new Vector3(-Infinity, -Infinity, -Infinity);
	    };

	    BoundingBox.prototype = {

	        constructor: BoundingBox,
	        /**
	         * Update min and max coords from a vertices array
	         * @param  {array} vertices
	         */
	        updateFromVertices: function (vertices) {
	            if (vertices.length > 0) {
	                var min = this.min;
	                var max = this.max;
	                var minArr = min._array;
	                var maxArr = max._array;
	                vec3Copy(minArr, vertices[0]);
	                vec3Copy(maxArr, vertices[0]);
	                for (var i = 1; i < vertices.length; i++) {
	                    var vertex = vertices[i];

	                    if (vertex[0] < minArr[0]) { minArr[0] = vertex[0]; }
	                    if (vertex[1] < minArr[1]) { minArr[1] = vertex[1]; }
	                    if (vertex[2] < minArr[2]) { minArr[2] = vertex[2]; }

	                    if (vertex[0] > maxArr[0]) { maxArr[0] = vertex[0]; }
	                    if (vertex[1] > maxArr[1]) { maxArr[1] = vertex[1]; }
	                    if (vertex[2] > maxArr[2]) { maxArr[2] = vertex[2]; }
	                }
	                min._dirty = true;
	                max._dirty = true;
	            }
	        },

	        /**
	         * Union operation with another bounding box
	         * @param  {qtek.math.BoundingBox} bbox
	         */
	        union: function (bbox) {
	            var min = this.min;
	            var max = this.max;
	            vec3.min(min._array, min._array, bbox.min._array);
	            vec3.max(max._array, max._array, bbox.max._array);
	            min._dirty = true;
	            max._dirty = true;
	        },

	        /**
	         * If intersect with another bounding box
	         * @param  {qtek.math.BoundingBox} bbox
	         * @return {boolean}
	         */
	        intersectBoundingBox: function (bbox) {
	            var _min = this.min._array;
	            var _max = this.max._array;

	            var _min2 = bbox.min._array;
	            var _max2 = bbox.max._array;

	            return ! (_min[0] > _max2[0] || _min[1] > _max2[1] || _min[2] > _max2[2]
	                || _max[0] < _min2[0] || _max[1] < _min2[1] || _max[2] < _min2[2]);
	        },

	        /**
	         * If contain another bounding box entirely
	         * @param  {qtek.math.BoundingBox} bbox
	         * @return {boolean}
	         */
	        containBoundingBox: function (bbox) {

	            var _min = this.min._array;
	            var _max = this.max._array;

	            var _min2 = bbox.min._array;
	            var _max2 = bbox.max._array;

	            return _min[0] <= _min2[0] && _min[1] <= _min2[1] && _min[2] <= _min2[2]
	                && _max[0] >= _max2[0] && _max[1] >= _max2[1] && _max[2] >= _max2[2];
	        },

	        /**
	         * If contain point entirely
	         * @param  {qtek.math.Vector3} point
	         * @return {boolean}
	         */
	        containPoint: function (p) {
	            var _min = this.min._array;
	            var _max = this.max._array;

	            var _p = p._array;

	            return _min[0] <= _p[0] && _min[1] <= _p[1] && _min[2] <= _p[2]
	                && _max[0] >= _p[0] && _max[1] >= _p[1] && _max[2] >= _p[2];
	        },

	        /**
	         * If bounding box is finite
	         */
	        isFinite: function () {
	            var _min = this.min._array;
	            var _max = this.max._array;
	            return isFinite(_min[0]) && isFinite(_min[1]) && isFinite(_min[2])
	                && isFinite(_max[0]) && isFinite(_max[1]) && isFinite(_max[2]);
	        },

	        /**
	         * Apply an affine transform matrix to the bounding box
	         * @param  {qtek.math.Matrix4} matrix
	         */
	        applyTransform: (function () {
	            // http://dev.theomader.com/transform-bounding-boxes/
	            var xa = vec3.create();
	            var xb = vec3.create();
	            var ya = vec3.create();
	            var yb = vec3.create();
	            var za = vec3.create();
	            var zb = vec3.create();

	            return function (matrix) {
	                var min = this.min._array;
	                var max = this.max._array;

	                var m = matrix._array;

	                xa[0] = m[0] * min[0]; xa[1] = m[1] * min[1]; xa[2] = m[2] * min[2];
	                xb[0] = m[0] * max[0]; xb[1] = m[1] * max[1]; xb[2] = m[2] * max[2];

	                ya[0] = m[4] * min[0]; ya[1] = m[5] * min[1]; ya[2] = m[6] * min[2];
	                yb[0] = m[4] * max[0]; yb[1] = m[5] * max[1]; yb[2] = m[6] * max[2];

	                za[0] = m[8] * min[0]; za[1] = m[9] * min[1]; za[2] = m[10] * min[2];
	                zb[0] = m[8] * max[0]; zb[1] = m[9] * max[1]; zb[2] = m[10] * max[2];

	                min[0] = Math.min(xa[0], xb[0]) + Math.min(ya[0], yb[0]) + Math.min(za[0], zb[0]) + m[12];
	                min[1] = Math.min(xa[1], xb[1]) + Math.min(ya[1], yb[1]) + Math.min(za[1], zb[1]) + m[13];
	                min[2] = Math.min(xa[2], xb[2]) + Math.min(ya[2], yb[2]) + Math.min(za[2], zb[2]) + m[14];

	                max[0] = Math.max(xa[0], xb[0]) + Math.max(ya[0], yb[0]) + Math.max(za[0], zb[0]) + m[12];
	                max[1] = Math.max(xa[1], xb[1]) + Math.max(ya[1], yb[1]) + Math.max(za[1], zb[1]) + m[13];
	                max[2] = Math.max(xa[2], xb[2]) + Math.max(ya[2], yb[2]) + Math.max(za[2], zb[2]) + m[14];

	                this.min._dirty = true;
	                this.max._dirty = true;
	            };
	        })(),

	        /**
	         * Apply a projection matrix to the bounding box
	         * @param  {qtek.math.Matrix4} matrix
	         */
	        applyProjection: function (matrix) {
	            var min = this.min._array;
	            var max = this.max._array;

	            var m = matrix._array;
	            // min in min z
	            var v10 = min[0];
	            var v11 = min[1];
	            var v12 = min[2];
	            // max in min z
	            var v20 = max[0];
	            var v21 = max[1];
	            var v22 = min[2];
	            // max in max z
	            var v30 = max[0];
	            var v31 = max[1];
	            var v32 = max[2];

	            if (m[15] === 1) {  // Orthographic projection
	                min[0] = m[0] * v10 + m[12];
	                min[1] = m[5] * v11 + m[13];
	                max[2] = m[10] * v12 + m[14];

	                max[0] = m[0] * v30 + m[12];
	                max[1] = m[5] * v31 + m[13];
	                min[2] = m[10] * v32 + m[14];
	            }
	            else {
	                var w = -1 / v12;
	                min[0] = m[0] * v10 * w;
	                min[1] = m[5] * v11 * w;
	                max[2] = (m[10] * v12 + m[14]) * w;

	                w = -1 / v22;
	                max[0] = m[0] * v20 * w;
	                max[1] = m[5] * v21 * w;

	                w = -1 / v32;
	                min[2] = (m[10] * v32 + m[14]) * w;
	            }
	            this.min._dirty = true;
	            this.max._dirty = true;
	        },

	        updateVertices: function () {
	            var vertices = this.vertices;
	            if (!vertices) {
	                // Cube vertices
	                var vertices = [];
	                for (var i = 0; i < 8; i++) {
	                    vertices[i] = vec3.fromValues(0, 0, 0);
	                }

	                /**
	                 * Eight coords of bounding box
	                 * @type {Float32Array[]}
	                 */
	                this.vertices = vertices;
	            }
	            var min = this.min._array;
	            var max = this.max._array;
	            //--- min z
	            // min x
	            vec3Set(vertices[0], min[0], min[1], min[2]);
	            vec3Set(vertices[1], min[0], max[1], min[2]);
	            // max x
	            vec3Set(vertices[2], max[0], min[1], min[2]);
	            vec3Set(vertices[3], max[0], max[1], min[2]);

	            //-- max z
	            vec3Set(vertices[4], min[0], min[1], max[2]);
	            vec3Set(vertices[5], min[0], max[1], max[2]);
	            vec3Set(vertices[6], max[0], min[1], max[2]);
	            vec3Set(vertices[7], max[0], max[1], max[2]);
	        },
	        /**
	         * Copy values from another bounding box
	         * @param  {qtek.math.BoundingBox} bbox
	         */
	        copy: function (bbox) {
	            var min = this.min;
	            var max = this.max;
	            vec3Copy(min._array, bbox.min._array);
	            vec3Copy(max._array, bbox.max._array);
	            min._dirty = true;
	            max._dirty = true;
	        },

	        /**
	         * Clone a new bounding box
	         * @return {qtek.math.BoundingBox}
	         */
	        clone: function () {
	            var boundingBox = new BoundingBox();
	            boundingBox.copy(this);
	            return boundingBox;
	        }
	    };

	    module.exports = BoundingBox;


/***/ },
/* 14 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';


	    var glMatrix = __webpack_require__(15);
	    var vec3 = glMatrix.vec3;

	    /**
	     * @constructor
	     * @alias qtek.math.Vector3
	     * @param {number} x
	     * @param {number} y
	     * @param {number} z
	     */
	    var Vector3 = function(x, y, z) {

	        x = x || 0;
	        y = y || 0;
	        z = z || 0;

	        /**
	         * Storage of Vector3, read and write of x, y, z will change the values in _array
	         * All methods also operate on the _array instead of x, y, z components
	         * @name _array
	         * @type {Float32Array}
	         */
	        this._array = vec3.fromValues(x, y, z);

	        /**
	         * Dirty flag is used by the Node to determine
	         * if the matrix is updated to latest
	         * @name _dirty
	         * @type {boolean}
	         */
	        this._dirty = true;
	    };

	    Vector3.prototype = {

	        constructor : Vector3,

	        /**
	         * Add b to self
	         * @param  {qtek.math.Vector3} b
	         * @return {qtek.math.Vector3}
	         */
	        add: function (b) {
	            vec3.add(this._array, this._array, b._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Set x, y and z components
	         * @param  {number}  x
	         * @param  {number}  y
	         * @param  {number}  z
	         * @return {qtek.math.Vector3}
	         */
	        set: function (x, y, z) {
	            this._array[0] = x;
	            this._array[1] = y;
	            this._array[2] = z;
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Set x, y and z components from array
	         * @param  {Float32Array|number[]} arr
	         * @return {qtek.math.Vector3}
	         */
	        setArray: function (arr) {
	            this._array[0] = arr[0];
	            this._array[1] = arr[1];
	            this._array[2] = arr[2];

	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Clone a new Vector3
	         * @return {qtek.math.Vector3}
	         */
	        clone: function () {
	            return new Vector3(this.x, this.y, this.z);
	        },

	        /**
	         * Copy from b
	         * @param  {qtek.math.Vector3} b
	         * @return {qtek.math.Vector3}
	         */
	        copy: function (b) {
	            vec3.copy(this._array, b._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Cross product of self and b, written to a Vector3 out
	         * @param  {qtek.math.Vector3} a
	         * @param  {qtek.math.Vector3} b
	         * @return {qtek.math.Vector3}
	         */
	        cross: function (a, b) {
	            vec3.cross(this._array, a._array, b._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Alias for distance
	         * @param  {qtek.math.Vector3} b
	         * @return {number}
	         */
	        dist: function (b) {
	            return vec3.dist(this._array, b._array);
	        },

	        /**
	         * Distance between self and b
	         * @param  {qtek.math.Vector3} b
	         * @return {number}
	         */
	        distance: function (b) {
	            return vec3.distance(this._array, b._array);
	        },

	        /**
	         * Alias for divide
	         * @param  {qtek.math.Vector3} b
	         * @return {qtek.math.Vector3}
	         */
	        div: function (b) {
	            vec3.div(this._array, this._array, b._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Divide self by b
	         * @param  {qtek.math.Vector3} b
	         * @return {qtek.math.Vector3}
	         */
	        divide: function (b) {
	            vec3.divide(this._array, this._array, b._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Dot product of self and b
	         * @param  {qtek.math.Vector3} b
	         * @return {number}
	         */
	        dot: function (b) {
	            return vec3.dot(this._array, b._array);
	        },

	        /**
	         * Alias of length
	         * @return {number}
	         */
	        len: function () {
	            return vec3.len(this._array);
	        },

	        /**
	         * Calculate the length
	         * @return {number}
	         */
	        length: function () {
	            return vec3.length(this._array);
	        },
	        /**
	         * Linear interpolation between a and b
	         * @param  {qtek.math.Vector3} a
	         * @param  {qtek.math.Vector3} b
	         * @param  {number}  t
	         * @return {qtek.math.Vector3}
	         */
	        lerp: function (a, b, t) {
	            vec3.lerp(this._array, a._array, b._array, t);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Minimum of self and b
	         * @param  {qtek.math.Vector3} b
	         * @return {qtek.math.Vector3}
	         */
	        min: function (b) {
	            vec3.min(this._array, this._array, b._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Maximum of self and b
	         * @param  {qtek.math.Vector3} b
	         * @return {qtek.math.Vector3}
	         */
	        max: function (b) {
	            vec3.max(this._array, this._array, b._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Alias for multiply
	         * @param  {qtek.math.Vector3} b
	         * @return {qtek.math.Vector3}
	         */
	        mul: function (b) {
	            vec3.mul(this._array, this._array, b._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Mutiply self and b
	         * @param  {qtek.math.Vector3} b
	         * @return {qtek.math.Vector3}
	         */
	        multiply: function (b) {
	            vec3.multiply(this._array, this._array, b._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Negate self
	         * @return {qtek.math.Vector3}
	         */
	        negate: function () {
	            vec3.negate(this._array, this._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Normalize self
	         * @return {qtek.math.Vector3}
	         */
	        normalize: function () {
	            vec3.normalize(this._array, this._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Generate random x, y, z components with a given scale
	         * @param  {number} scale
	         * @return {qtek.math.Vector3}
	         */
	        random: function (scale) {
	            vec3.random(this._array, scale);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Scale self
	         * @param  {number}  scale
	         * @return {qtek.math.Vector3}
	         */
	        scale: function (s) {
	            vec3.scale(this._array, this._array, s);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Scale b and add to self
	         * @param  {qtek.math.Vector3} b
	         * @param  {number}  scale
	         * @return {qtek.math.Vector3}
	         */
	        scaleAndAdd: function (b, s) {
	            vec3.scaleAndAdd(this._array, this._array, b._array, s);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Alias for squaredDistance
	         * @param  {qtek.math.Vector3} b
	         * @return {number}
	         */
	        sqrDist: function (b) {
	            return vec3.sqrDist(this._array, b._array);
	        },

	        /**
	         * Squared distance between self and b
	         * @param  {qtek.math.Vector3} b
	         * @return {number}
	         */
	        squaredDistance: function (b) {
	            return vec3.squaredDistance(this._array, b._array);
	        },

	        /**
	         * Alias for squaredLength
	         * @return {number}
	         */
	        sqrLen: function () {
	            return vec3.sqrLen(this._array);
	        },

	        /**
	         * Squared length of self
	         * @return {number}
	         */
	        squaredLength: function () {
	            return vec3.squaredLength(this._array);
	        },

	        /**
	         * Alias for subtract
	         * @param  {qtek.math.Vector3} b
	         * @return {qtek.math.Vector3}
	         */
	        sub: function (b) {
	            vec3.sub(this._array, this._array, b._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Subtract b from self
	         * @param  {qtek.math.Vector3} b
	         * @return {qtek.math.Vector3}
	         */
	        subtract: function (b) {
	            vec3.subtract(this._array, this._array, b._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Transform self with a Matrix3 m
	         * @param  {qtek.math.Matrix3} m
	         * @return {qtek.math.Vector3}
	         */
	        transformMat3: function (m) {
	            vec3.transformMat3(this._array, this._array, m._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Transform self with a Matrix4 m
	         * @param  {qtek.math.Matrix4} m
	         * @return {qtek.math.Vector3}
	         */
	        transformMat4: function (m) {
	            vec3.transformMat4(this._array, this._array, m._array);
	            this._dirty = true;
	            return this;
	        },
	        /**
	         * Transform self with a Quaternion q
	         * @param  {qtek.math.Quaternion} q
	         * @return {qtek.math.Vector3}
	         */
	        transformQuat: function (q) {
	            vec3.transformQuat(this._array, this._array, q._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Trasnform self into projection space with m
	         * @param  {qtek.math.Matrix4} m
	         * @return {qtek.math.Vector3}
	         */
	        applyProjection: function (m) {
	            var v = this._array;
	            m = m._array;

	            // Perspective projection
	            if (m[15] === 0) {
	                var w = -1 / v[2];
	                v[0] = m[0] * v[0] * w;
	                v[1] = m[5] * v[1] * w;
	                v[2] = (m[10] * v[2] + m[14]) * w;
	            }
	            else {
	                v[0] = m[0] * v[0] + m[12];
	                v[1] = m[5] * v[1] + m[13];
	                v[2] = m[10] * v[2] + m[14];
	            }
	            this._dirty = true;

	            return this;
	        },

	        eulerFromQuat: function(q, order) {
	            Vector3.eulerFromQuat(this, q, order);
	        },

	        eulerFromMat3: function (m, order) {
	            Vector3.eulerFromMat3(this, m, order);
	        },

	        toString: function() {
	            return '[' + Array.prototype.join.call(this._array, ',') + ']';
	        },

	        toArray: function () {
	            return Array.prototype.slice.call(this._array);
	        }
	    };

	    var defineProperty = Object.defineProperty;
	    // Getter and Setter
	    if (defineProperty) {

	        var proto = Vector3.prototype;
	        /**
	         * @name x
	         * @type {number}
	         * @memberOf qtek.math.Vector3
	         * @instance
	         */
	        defineProperty(proto, 'x', {
	            get: function () {
	                return this._array[0];
	            },
	            set: function (value) {
	                this._array[0] = value;
	                this._dirty = true;
	            }
	        });

	        /**
	         * @name y
	         * @type {number}
	         * @memberOf qtek.math.Vector3
	         * @instance
	         */
	        defineProperty(proto, 'y', {
	            get: function () {
	                return this._array[1];
	            },
	            set: function (value) {
	                this._array[1] = value;
	                this._dirty = true;
	            }
	        });

	        /**
	         * @name z
	         * @type {number}
	         * @memberOf qtek.math.Vector3
	         * @instance
	         */
	        defineProperty(proto, 'z', {
	            get: function () {
	                return this._array[2];
	            },
	            set: function (value) {
	                this._array[2] = value;
	                this._dirty = true;
	            }
	        });
	    }


	    // Supply methods that are not in place

	    /**
	     * @param  {qtek.math.Vector3} out
	     * @param  {qtek.math.Vector3} a
	     * @param  {qtek.math.Vector3} b
	     * @return {qtek.math.Vector3}
	     */
	    Vector3.add = function(out, a, b) {
	        vec3.add(out._array, a._array, b._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Vector3} out
	     * @param  {number}  x
	     * @param  {number}  y
	     * @param  {number}  z
	     * @return {qtek.math.Vector3}
	     */
	    Vector3.set = function(out, x, y, z) {
	        vec3.set(out._array, x, y, z);
	        out._dirty = true;
	    };

	    /**
	     * @param  {qtek.math.Vector3} out
	     * @param  {qtek.math.Vector3} b
	     * @return {qtek.math.Vector3}
	     */
	    Vector3.copy = function(out, b) {
	        vec3.copy(out._array, b._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Vector3} out
	     * @param  {qtek.math.Vector3} a
	     * @param  {qtek.math.Vector3} b
	     * @return {qtek.math.Vector3}
	     */
	    Vector3.cross = function(out, a, b) {
	        vec3.cross(out._array, a._array, b._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Vector3} a
	     * @param  {qtek.math.Vector3} b
	     * @return {number}
	     */
	    Vector3.dist = function(a, b) {
	        return vec3.distance(a._array, b._array);
	    };

	    /**
	     * @method
	     * @param  {qtek.math.Vector3} a
	     * @param  {qtek.math.Vector3} b
	     * @return {number}
	     */
	    Vector3.distance = Vector3.dist;

	    /**
	     * @param  {qtek.math.Vector3} out
	     * @param  {qtek.math.Vector3} a
	     * @param  {qtek.math.Vector3} b
	     * @return {qtek.math.Vector3}
	     */
	    Vector3.div = function(out, a, b) {
	        vec3.divide(out._array, a._array, b._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @method
	     * @param  {qtek.math.Vector3} out
	     * @param  {qtek.math.Vector3} a
	     * @param  {qtek.math.Vector3} b
	     * @return {qtek.math.Vector3}
	     */
	    Vector3.divide = Vector3.div;

	    /**
	     * @param  {qtek.math.Vector3} a
	     * @param  {qtek.math.Vector3} b
	     * @return {number}
	     */
	    Vector3.dot = function(a, b) {
	        return vec3.dot(a._array, b._array);
	    };

	    /**
	     * @param  {qtek.math.Vector3} a
	     * @return {number}
	     */
	    Vector3.len = function(b) {
	        return vec3.length(b._array);
	    };

	    // Vector3.length = Vector3.len;

	    /**
	     * @param  {qtek.math.Vector3} out
	     * @param  {qtek.math.Vector3} a
	     * @param  {qtek.math.Vector3} b
	     * @param  {number}  t
	     * @return {qtek.math.Vector3}
	     */
	    Vector3.lerp = function(out, a, b, t) {
	        vec3.lerp(out._array, a._array, b._array, t);
	        out._dirty = true;
	        return out;
	    };
	    /**
	     * @param  {qtek.math.Vector3} out
	     * @param  {qtek.math.Vector3} a
	     * @param  {qtek.math.Vector3} b
	     * @return {qtek.math.Vector3}
	     */
	    Vector3.min = function(out, a, b) {
	        vec3.min(out._array, a._array, b._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Vector3} out
	     * @param  {qtek.math.Vector3} a
	     * @param  {qtek.math.Vector3} b
	     * @return {qtek.math.Vector3}
	     */
	    Vector3.max = function(out, a, b) {
	        vec3.max(out._array, a._array, b._array);
	        out._dirty = true;
	        return out;
	    };
	    /**
	     * @param  {qtek.math.Vector3} out
	     * @param  {qtek.math.Vector3} a
	     * @param  {qtek.math.Vector3} b
	     * @return {qtek.math.Vector3}
	     */
	    Vector3.mul = function(out, a, b) {
	        vec3.multiply(out._array, a._array, b._array);
	        out._dirty = true;
	        return out;
	    };
	    /**
	     * @method
	     * @param  {qtek.math.Vector3} out
	     * @param  {qtek.math.Vector3} a
	     * @param  {qtek.math.Vector3} b
	     * @return {qtek.math.Vector3}
	     */
	    Vector3.multiply = Vector3.mul;
	    /**
	     * @param  {qtek.math.Vector3} out
	     * @param  {qtek.math.Vector3} a
	     * @return {qtek.math.Vector3}
	     */
	    Vector3.negate = function(out, a) {
	        vec3.negate(out._array, a._array);
	        out._dirty = true;
	        return out;
	    };
	    /**
	     * @param  {qtek.math.Vector3} out
	     * @param  {qtek.math.Vector3} a
	     * @return {qtek.math.Vector3}
	     */
	    Vector3.normalize = function(out, a) {
	        vec3.normalize(out._array, a._array);
	        out._dirty = true;
	        return out;
	    };
	    /**
	     * @param  {qtek.math.Vector3} out
	     * @param  {number}  scale
	     * @return {qtek.math.Vector3}
	     */
	    Vector3.random = function(out, scale) {
	        vec3.random(out._array, scale);
	        out._dirty = true;
	        return out;
	    };
	    /**
	     * @param  {qtek.math.Vector3} out
	     * @param  {qtek.math.Vector3} a
	     * @param  {number}  scale
	     * @return {qtek.math.Vector3}
	     */
	    Vector3.scale = function(out, a, scale) {
	        vec3.scale(out._array, a._array, scale);
	        out._dirty = true;
	        return out;
	    };
	    /**
	     * @param  {qtek.math.Vector3} out
	     * @param  {qtek.math.Vector3} a
	     * @param  {qtek.math.Vector3} b
	     * @param  {number}  scale
	     * @return {qtek.math.Vector3}
	     */
	    Vector3.scaleAndAdd = function(out, a, b, scale) {
	        vec3.scaleAndAdd(out._array, a._array, b._array, scale);
	        out._dirty = true;
	        return out;
	    };
	    /**
	     * @param  {qtek.math.Vector3} a
	     * @param  {qtek.math.Vector3} b
	     * @return {number}
	     */
	    Vector3.sqrDist = function(a, b) {
	        return vec3.sqrDist(a._array, b._array);
	    };
	    /**
	     * @method
	     * @param  {qtek.math.Vector3} a
	     * @param  {qtek.math.Vector3} b
	     * @return {number}
	     */
	    Vector3.squaredDistance = Vector3.sqrDist;
	    /**
	     * @param  {qtek.math.Vector3} a
	     * @return {number}
	     */
	    Vector3.sqrLen = function(a) {
	        return vec3.sqrLen(a._array);
	    };
	    /**
	     * @method
	     * @param  {qtek.math.Vector3} a
	     * @return {number}
	     */
	    Vector3.squaredLength = Vector3.sqrLen;

	    /**
	     * @param  {qtek.math.Vector3} out
	     * @param  {qtek.math.Vector3} a
	     * @param  {qtek.math.Vector3} b
	     * @return {qtek.math.Vector3}
	     */
	    Vector3.sub = function(out, a, b) {
	        vec3.subtract(out._array, a._array, b._array);
	        out._dirty = true;
	        return out;
	    };
	    /**
	     * @method
	     * @param  {qtek.math.Vector3} out
	     * @param  {qtek.math.Vector3} a
	     * @param  {qtek.math.Vector3} b
	     * @return {qtek.math.Vector3}
	     */
	    Vector3.subtract = Vector3.sub;

	    /**
	     * @param  {qtek.math.Vector3} out
	     * @param  {qtek.math.Vector3} a
	     * @param  {Matrix3} m
	     * @return {qtek.math.Vector3}
	     */
	    Vector3.transformMat3 = function(out, a, m) {
	        vec3.transformMat3(out._array, a._array, m._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Vector3} out
	     * @param  {qtek.math.Vector3} a
	     * @param  {qtek.math.Matrix4} m
	     * @return {qtek.math.Vector3}
	     */
	    Vector3.transformMat4 = function(out, a, m) {
	        vec3.transformMat4(out._array, a._array, m._array);
	        out._dirty = true;
	        return out;
	    };
	    /**
	     * @param  {qtek.math.Vector3} out
	     * @param  {qtek.math.Vector3} a
	     * @param  {qtek.math.Quaternion} q
	     * @return {qtek.math.Vector3}
	     */
	    Vector3.transformQuat = function(out, a, q) {
	        vec3.transformQuat(out._array, a._array, q._array);
	        out._dirty = true;
	        return out;
	    };

	    function clamp(val, min, max) {
	        return val < min ? min : (val > max ? max : val);
	    }
	    var atan2 = Math.atan2;
	    var asin = Math.asin;
	    var abs = Math.abs;
	    /**
	     * Convert quaternion to euler angle
	     * Quaternion must be normalized
	     * From three.js
	     */
	    Vector3.eulerFromQuat = function (out, q, order) {
	        out._dirty = true;
	        q = q._array;

	        var target = out._array;
	        var x = q[0], y = q[1], z = q[2], w = q[3];
	        var x2 = x * x;
	        var y2 = y * y;
	        var z2 = z * z;
	        var w2 = w * w;

	        var order = (order || 'XYZ').toUpperCase();

	        switch (order) {
	            case 'XYZ':
	                target[0] = atan2(2 * (x * w - y * z), (w2 - x2 - y2 + z2));
	                target[1] = asin(clamp(2 * (x * z + y * w), - 1, 1));
	                target[2] = atan2(2 * (z * w - x * y), (w2 + x2 - y2 - z2));
	                break;
	            case 'YXZ':
	                target[0] = asin(clamp(2 * (x * w - y * z), - 1, 1));
	                target[1] = atan2(2 * (x * z + y * w), (w2 - x2 - y2 + z2));
	                target[2] = atan2(2 * (x * y + z * w), (w2 - x2 + y2 - z2));
	                break;
	            case 'ZXY':
	                target[0] = asin(clamp(2 * (x * w + y * z), - 1, 1));
	                target[1] = atan2(2 * (y * w - z * x), (w2 - x2 - y2 + z2));
	                target[2] = atan2(2 * (z * w - x * y), (w2 - x2 + y2 - z2));
	                break;
	            case 'ZYX':
	                target[0] = atan2(2 * (x * w + z * y), (w2 - x2 - y2 + z2));
	                target[1] = asin(clamp(2 * (y * w - x * z), - 1, 1));
	                target[2] = atan2(2 * (x * y + z * w), (w2 + x2 - y2 - z2));
	                break;
	            case 'YZX':
	                target[0] = atan2(2 * (x * w - z * y), (w2 - x2 + y2 - z2));
	                target[1] = atan2(2 * (y * w - x * z), (w2 + x2 - y2 - z2));
	                target[2] = asin(clamp(2 * (x * y + z * w), - 1, 1));
	                break;
	            case 'XZY':
	                target[0] = atan2(2 * (x * w + y * z), (w2 - x2 + y2 - z2));
	                target[1] = atan2(2 * (x * z + y * w), (w2 + x2 - y2 - z2));
	                target[2] = asin(clamp(2 * (z * w - x * y), - 1, 1));
	                break;
	            default:
	                console.warn('Unkown order: ' + order);
	        }
	        return out;
	    };

	    /**
	     * Convert rotation matrix to euler angle
	     * from three.js
	     * @param  {[type]} v     [description]
	     * @param  {[type]} m     [description]
	     * @param  {[type]} order [description]
	     * @return {[type]}       [description]
	     */
	    Vector3.eulerFromMat3 = function (out, m, order) {
	        // assumes the upper 3x3 of m is a pure rotation matrix (i.e, unscaled)
	        var te = m._array;
	        var m11 = te[0], m12 = te[3], m13 = te[6];
	        var m21 = te[1], m22 = te[4], m23 = te[7];
	        var m31 = te[2], m32 = te[5], m33 = te[8];
	        var target = out._array;

	        var order = (order || 'XYZ').toUpperCase();

	        switch (order) {
	            case 'XYZ':
	                target[1] = asin(clamp(m13, -1, 1));
	                if (abs(m13) < 0.99999) {
	                    target[0] = atan2(-m23, m33);
	                    target[2] = atan2(-m12, m11);
	                }
	                else {
	                    target[0] = atan2(m32, m22);
	                    target[2] = 0;
	                }
	                break;
	            case 'YXZ':
	                target[0] = asin(-clamp(m23, -1, 1));
	                if (abs(m23) < 0.99999) {
	                    target[1] = atan2(m13, m33);
	                    target[2] = atan2(m21, m22);
	                }
	                else {
	                    target[1] = atan2(-m31, m11);
	                    target[2] = 0;
	                }
	                break;
	            case 'ZXY':
	                target[0] = asin(clamp(m32, -1, 1));
	                if (abs(m32) < 0.99999) {
	                    target[1] = atan2(-m31, m33);
	                    target[2] = atan2(-m12, m22);
	                }
	                else {
	                    target[1] = 0;
	                    target[2] = atan2(m21, m11);
	                }
	                break;
	            case 'ZYX':
	                target[1] = asin(-clamp(m31, -1, 1));
	                if (abs(m31) < 0.99999) {
	                    target[0] = atan2(m32, m33);
	                    target[2] = atan2(m21, m11);
	                }
	                else {
	                    target[0] = 0;
	                    target[2] = atan2(-m12, m22);
	                }
	                break;
	            case 'YZX':
	                target[2] = asin(clamp(m21, -1, 1));
	                if (abs(m21) < 0.99999) {
	                    target[0] = atan2(-m23, m22);
	                    target[1] = atan2(-m31, m11);
	                }
	                else {
	                    target[0] = 0;
	                    target[1] = atan2(m13, m33);
	                }
	                break;
	            case 'XZY':
	                target[2] = asin(-clamp(m12, -1, 1));
	                if (abs(m12) < 0.99999) {
	                    target[0] = atan2(m32, m22);
	                    target[1] = atan2(m13, m11);
	                }
	                else {
	                    target[0] = atan2(-m23, m33);
	                    target[1] = 0;
	                }
	                break;
	            default:
	                console.warn('Unkown order: ' + order);
	        }
	        out._dirty = true;

	        return out;
	    };

	    /**
	     * @type {qtek.math.Vector3}
	     */
	    Vector3.POSITIVE_X = new Vector3(1, 0, 0);
	    /**
	     * @type {qtek.math.Vector3}
	     */
	    Vector3.NEGATIVE_X = new Vector3(-1, 0, 0);
	    /**
	     * @type {qtek.math.Vector3}
	     */
	    Vector3.POSITIVE_Y = new Vector3(0, 1, 0);
	    /**
	     * @type {qtek.math.Vector3}
	     */
	    Vector3.NEGATIVE_Y = new Vector3(0, -1, 0);
	    /**
	     * @type {qtek.math.Vector3}
	     */
	    Vector3.POSITIVE_Z = new Vector3(0, 0, 1);
	    /**
	     * @type {qtek.math.Vector3}
	     */
	    Vector3.NEGATIVE_Z = new Vector3(0, 0, -1);
	    /**
	     * @type {qtek.math.Vector3}
	     */
	    Vector3.UP = new Vector3(0, 1, 0);
	    /**
	     * @type {qtek.math.Vector3}
	     */
	    Vector3.ZERO = new Vector3(0, 0, 0);

	    module.exports = Vector3;


/***/ },
/* 15 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * @fileoverview gl-matrix - High performance matrix and vector operations
	 * @author Brandon Jones
	 * @author Colin MacKenzie IV
	 * @version 2.2.2
	 */

	/* Copyright (c) 2013, Brandon Jones, Colin MacKenzie IV. All rights reserved.

	Redistribution and use in source and binary forms, with or without modification,
	are permitted provided that the following conditions are met:

	  * Redistributions of source code must retain the above copyright notice, this
	    list of conditions and the following disclaimer.
	  * Redistributions in binary form must reproduce the above copyright notice,
	    this list of conditions and the following disclaimer in the documentation
	    and/or other materials provided with the distribution.

	THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
	ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
	WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
	DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
	ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
	(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
	LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
	ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
	(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
	SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */


	(function(_global) {
	  "use strict";

	  var shim = {};
	  if (false) {
	    if(typeof define == 'function' && typeof define.amd == 'object' && define.amd) {
	      shim.exports = {};
	      define(function() {
	        return shim.exports;
	      });
	    } else {
	      // gl-matrix lives in a browser, define its namespaces in global
	      shim.exports = typeof(window) !== 'undefined' ? window : _global;
	    }
	  }
	  else {
	    // gl-matrix lives in commonjs, define its namespaces in exports
	    shim.exports = exports;
	  }

	  (function(exports) {
	    /* Copyright (c) 2013, Brandon Jones, Colin MacKenzie IV. All rights reserved.

	Redistribution and use in source and binary forms, with or without modification,
	are permitted provided that the following conditions are met:

	  * Redistributions of source code must retain the above copyright notice, this
	    list of conditions and the following disclaimer.
	  * Redistributions in binary form must reproduce the above copyright notice,
	    this list of conditions and the following disclaimer in the documentation
	    and/or other materials provided with the distribution.

	THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
	ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
	WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
	DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
	ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
	(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
	LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
	ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
	(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
	SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */


	if(!GLMAT_EPSILON) {
	    var GLMAT_EPSILON = 0.000001;
	}

	if(!GLMAT_ARRAY_TYPE) {
	    var GLMAT_ARRAY_TYPE = (typeof Float32Array !== 'undefined') ? Float32Array : Array;
	}

	if(!GLMAT_RANDOM) {
	    var GLMAT_RANDOM = Math.random;
	}

	/**
	 * @class Common utilities
	 * @name glMatrix
	 */
	var glMatrix = {};

	/**
	 * Sets the type of array used when creating new vectors and matrices
	 *
	 * @param {Type} type Array type, such as Float32Array or Array
	 */
	glMatrix.setMatrixArrayType = function(type) {
	    GLMAT_ARRAY_TYPE = type;
	}

	if(typeof(exports) !== 'undefined') {
	    exports.glMatrix = glMatrix;
	}

	var degree = Math.PI / 180;

	/**
	* Convert Degree To Radian
	*
	* @param {Number} Angle in Degrees
	*/
	glMatrix.toRadian = function(a){
	     return a * degree;
	}
	;
	/* Copyright (c) 2013, Brandon Jones, Colin MacKenzie IV. All rights reserved.

	Redistribution and use in source and binary forms, with or without modification,
	are permitted provided that the following conditions are met:

	  * Redistributions of source code must retain the above copyright notice, this
	    list of conditions and the following disclaimer.
	  * Redistributions in binary form must reproduce the above copyright notice,
	    this list of conditions and the following disclaimer in the documentation
	    and/or other materials provided with the distribution.

	THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
	ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
	WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
	DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
	ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
	(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
	LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
	ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
	(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
	SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */

	/**
	 * @class 2 Dimensional Vector
	 * @name vec2
	 */

	var vec2 = {};

	/**
	 * Creates a new, empty vec2
	 *
	 * @returns {vec2} a new 2D vector
	 */
	vec2.create = function() {
	    var out = new GLMAT_ARRAY_TYPE(2);
	    out[0] = 0;
	    out[1] = 0;
	    return out;
	};

	/**
	 * Creates a new vec2 initialized with values from an existing vector
	 *
	 * @param {vec2} a vector to clone
	 * @returns {vec2} a new 2D vector
	 */
	vec2.clone = function(a) {
	    var out = new GLMAT_ARRAY_TYPE(2);
	    out[0] = a[0];
	    out[1] = a[1];
	    return out;
	};

	/**
	 * Creates a new vec2 initialized with the given values
	 *
	 * @param {Number} x X component
	 * @param {Number} y Y component
	 * @returns {vec2} a new 2D vector
	 */
	vec2.fromValues = function(x, y) {
	    var out = new GLMAT_ARRAY_TYPE(2);
	    out[0] = x;
	    out[1] = y;
	    return out;
	};

	/**
	 * Copy the values from one vec2 to another
	 *
	 * @param {vec2} out the receiving vector
	 * @param {vec2} a the source vector
	 * @returns {vec2} out
	 */
	vec2.copy = function(out, a) {
	    out[0] = a[0];
	    out[1] = a[1];
	    return out;
	};

	/**
	 * Set the components of a vec2 to the given values
	 *
	 * @param {vec2} out the receiving vector
	 * @param {Number} x X component
	 * @param {Number} y Y component
	 * @returns {vec2} out
	 */
	vec2.set = function(out, x, y) {
	    out[0] = x;
	    out[1] = y;
	    return out;
	};

	/**
	 * Adds two vec2's
	 *
	 * @param {vec2} out the receiving vector
	 * @param {vec2} a the first operand
	 * @param {vec2} b the second operand
	 * @returns {vec2} out
	 */
	vec2.add = function(out, a, b) {
	    out[0] = a[0] + b[0];
	    out[1] = a[1] + b[1];
	    return out;
	};

	/**
	 * Subtracts vector b from vector a
	 *
	 * @param {vec2} out the receiving vector
	 * @param {vec2} a the first operand
	 * @param {vec2} b the second operand
	 * @returns {vec2} out
	 */
	vec2.subtract = function(out, a, b) {
	    out[0] = a[0] - b[0];
	    out[1] = a[1] - b[1];
	    return out;
	};

	/**
	 * Alias for {@link vec2.subtract}
	 * @function
	 */
	vec2.sub = vec2.subtract;

	/**
	 * Multiplies two vec2's
	 *
	 * @param {vec2} out the receiving vector
	 * @param {vec2} a the first operand
	 * @param {vec2} b the second operand
	 * @returns {vec2} out
	 */
	vec2.multiply = function(out, a, b) {
	    out[0] = a[0] * b[0];
	    out[1] = a[1] * b[1];
	    return out;
	};

	/**
	 * Alias for {@link vec2.multiply}
	 * @function
	 */
	vec2.mul = vec2.multiply;

	/**
	 * Divides two vec2's
	 *
	 * @param {vec2} out the receiving vector
	 * @param {vec2} a the first operand
	 * @param {vec2} b the second operand
	 * @returns {vec2} out
	 */
	vec2.divide = function(out, a, b) {
	    out[0] = a[0] / b[0];
	    out[1] = a[1] / b[1];
	    return out;
	};

	/**
	 * Alias for {@link vec2.divide}
	 * @function
	 */
	vec2.div = vec2.divide;

	/**
	 * Returns the minimum of two vec2's
	 *
	 * @param {vec2} out the receiving vector
	 * @param {vec2} a the first operand
	 * @param {vec2} b the second operand
	 * @returns {vec2} out
	 */
	vec2.min = function(out, a, b) {
	    out[0] = Math.min(a[0], b[0]);
	    out[1] = Math.min(a[1], b[1]);
	    return out;
	};

	/**
	 * Returns the maximum of two vec2's
	 *
	 * @param {vec2} out the receiving vector
	 * @param {vec2} a the first operand
	 * @param {vec2} b the second operand
	 * @returns {vec2} out
	 */
	vec2.max = function(out, a, b) {
	    out[0] = Math.max(a[0], b[0]);
	    out[1] = Math.max(a[1], b[1]);
	    return out;
	};

	/**
	 * Scales a vec2 by a scalar number
	 *
	 * @param {vec2} out the receiving vector
	 * @param {vec2} a the vector to scale
	 * @param {Number} b amount to scale the vector by
	 * @returns {vec2} out
	 */
	vec2.scale = function(out, a, b) {
	    out[0] = a[0] * b;
	    out[1] = a[1] * b;
	    return out;
	};

	/**
	 * Adds two vec2's after scaling the second operand by a scalar value
	 *
	 * @param {vec2} out the receiving vector
	 * @param {vec2} a the first operand
	 * @param {vec2} b the second operand
	 * @param {Number} scale the amount to scale b by before adding
	 * @returns {vec2} out
	 */
	vec2.scaleAndAdd = function(out, a, b, scale) {
	    out[0] = a[0] + (b[0] * scale);
	    out[1] = a[1] + (b[1] * scale);
	    return out;
	};

	/**
	 * Calculates the euclidian distance between two vec2's
	 *
	 * @param {vec2} a the first operand
	 * @param {vec2} b the second operand
	 * @returns {Number} distance between a and b
	 */
	vec2.distance = function(a, b) {
	    var x = b[0] - a[0],
	        y = b[1] - a[1];
	    return Math.sqrt(x*x + y*y);
	};

	/**
	 * Alias for {@link vec2.distance}
	 * @function
	 */
	vec2.dist = vec2.distance;

	/**
	 * Calculates the squared euclidian distance between two vec2's
	 *
	 * @param {vec2} a the first operand
	 * @param {vec2} b the second operand
	 * @returns {Number} squared distance between a and b
	 */
	vec2.squaredDistance = function(a, b) {
	    var x = b[0] - a[0],
	        y = b[1] - a[1];
	    return x*x + y*y;
	};

	/**
	 * Alias for {@link vec2.squaredDistance}
	 * @function
	 */
	vec2.sqrDist = vec2.squaredDistance;

	/**
	 * Calculates the length of a vec2
	 *
	 * @param {vec2} a vector to calculate length of
	 * @returns {Number} length of a
	 */
	vec2.length = function (a) {
	    var x = a[0],
	        y = a[1];
	    return Math.sqrt(x*x + y*y);
	};

	/**
	 * Alias for {@link vec2.length}
	 * @function
	 */
	vec2.len = vec2.length;

	/**
	 * Calculates the squared length of a vec2
	 *
	 * @param {vec2} a vector to calculate squared length of
	 * @returns {Number} squared length of a
	 */
	vec2.squaredLength = function (a) {
	    var x = a[0],
	        y = a[1];
	    return x*x + y*y;
	};

	/**
	 * Alias for {@link vec2.squaredLength}
	 * @function
	 */
	vec2.sqrLen = vec2.squaredLength;

	/**
	 * Negates the components of a vec2
	 *
	 * @param {vec2} out the receiving vector
	 * @param {vec2} a vector to negate
	 * @returns {vec2} out
	 */
	vec2.negate = function(out, a) {
	    out[0] = -a[0];
	    out[1] = -a[1];
	    return out;
	};

	/**
	 * Returns the inverse of the components of a vec2
	 *
	 * @param {vec2} out the receiving vector
	 * @param {vec2} a vector to invert
	 * @returns {vec2} out
	 */
	vec2.inverse = function(out, a) {
	  out[0] = 1.0 / a[0];
	  out[1] = 1.0 / a[1];
	  return out;
	};

	/**
	 * Normalize a vec2
	 *
	 * @param {vec2} out the receiving vector
	 * @param {vec2} a vector to normalize
	 * @returns {vec2} out
	 */
	vec2.normalize = function(out, a) {
	    var x = a[0],
	        y = a[1];
	    var len = x*x + y*y;
	    if (len > 0) {
	        //TODO: evaluate use of glm_invsqrt here?
	        len = 1 / Math.sqrt(len);
	        out[0] = a[0] * len;
	        out[1] = a[1] * len;
	    }
	    return out;
	};

	/**
	 * Calculates the dot product of two vec2's
	 *
	 * @param {vec2} a the first operand
	 * @param {vec2} b the second operand
	 * @returns {Number} dot product of a and b
	 */
	vec2.dot = function (a, b) {
	    return a[0] * b[0] + a[1] * b[1];
	};

	/**
	 * Computes the cross product of two vec2's
	 * Note that the cross product must by definition produce a 3D vector
	 *
	 * @param {vec3} out the receiving vector
	 * @param {vec2} a the first operand
	 * @param {vec2} b the second operand
	 * @returns {vec3} out
	 */
	vec2.cross = function(out, a, b) {
	    var z = a[0] * b[1] - a[1] * b[0];
	    out[0] = out[1] = 0;
	    out[2] = z;
	    return out;
	};

	/**
	 * Performs a linear interpolation between two vec2's
	 *
	 * @param {vec2} out the receiving vector
	 * @param {vec2} a the first operand
	 * @param {vec2} b the second operand
	 * @param {Number} t interpolation amount between the two inputs
	 * @returns {vec2} out
	 */
	vec2.lerp = function (out, a, b, t) {
	    var ax = a[0],
	        ay = a[1];
	    out[0] = ax + t * (b[0] - ax);
	    out[1] = ay + t * (b[1] - ay);
	    return out;
	};

	/**
	 * Generates a random vector with the given scale
	 *
	 * @param {vec2} out the receiving vector
	 * @param {Number} [scale] Length of the resulting vector. If ommitted, a unit vector will be returned
	 * @returns {vec2} out
	 */
	vec2.random = function (out, scale) {
	    scale = scale || 1.0;
	    var r = GLMAT_RANDOM() * 2.0 * Math.PI;
	    out[0] = Math.cos(r) * scale;
	    out[1] = Math.sin(r) * scale;
	    return out;
	};

	/**
	 * Transforms the vec2 with a mat2
	 *
	 * @param {vec2} out the receiving vector
	 * @param {vec2} a the vector to transform
	 * @param {mat2} m matrix to transform with
	 * @returns {vec2} out
	 */
	vec2.transformMat2 = function(out, a, m) {
	    var x = a[0],
	        y = a[1];
	    out[0] = m[0] * x + m[2] * y;
	    out[1] = m[1] * x + m[3] * y;
	    return out;
	};

	/**
	 * Transforms the vec2 with a mat2d
	 *
	 * @param {vec2} out the receiving vector
	 * @param {vec2} a the vector to transform
	 * @param {mat2d} m matrix to transform with
	 * @returns {vec2} out
	 */
	vec2.transformMat2d = function(out, a, m) {
	    var x = a[0],
	        y = a[1];
	    out[0] = m[0] * x + m[2] * y + m[4];
	    out[1] = m[1] * x + m[3] * y + m[5];
	    return out;
	};

	/**
	 * Transforms the vec2 with a mat3
	 * 3rd vector component is implicitly '1'
	 *
	 * @param {vec2} out the receiving vector
	 * @param {vec2} a the vector to transform
	 * @param {mat3} m matrix to transform with
	 * @returns {vec2} out
	 */
	vec2.transformMat3 = function(out, a, m) {
	    var x = a[0],
	        y = a[1];
	    out[0] = m[0] * x + m[3] * y + m[6];
	    out[1] = m[1] * x + m[4] * y + m[7];
	    return out;
	};

	/**
	 * Transforms the vec2 with a mat4
	 * 3rd vector component is implicitly '0'
	 * 4th vector component is implicitly '1'
	 *
	 * @param {vec2} out the receiving vector
	 * @param {vec2} a the vector to transform
	 * @param {mat4} m matrix to transform with
	 * @returns {vec2} out
	 */
	vec2.transformMat4 = function(out, a, m) {
	    var x = a[0],
	        y = a[1];
	    out[0] = m[0] * x + m[4] * y + m[12];
	    out[1] = m[1] * x + m[5] * y + m[13];
	    return out;
	};

	/**
	 * Perform some operation over an array of vec2s.
	 *
	 * @param {Array} a the array of vectors to iterate over
	 * @param {Number} stride Number of elements between the start of each vec2. If 0 assumes tightly packed
	 * @param {Number} offset Number of elements to skip at the beginning of the array
	 * @param {Number} count Number of vec2s to iterate over. If 0 iterates over entire array
	 * @param {Function} fn Function to call for each vector in the array
	 * @param {Object} [arg] additional argument to pass to fn
	 * @returns {Array} a
	 * @function
	 */
	vec2.forEach = (function() {
	    var vec = vec2.create();

	    return function(a, stride, offset, count, fn, arg) {
	        var i, l;
	        if(!stride) {
	            stride = 2;
	        }

	        if(!offset) {
	            offset = 0;
	        }

	        if(count) {
	            l = Math.min((count * stride) + offset, a.length);
	        } else {
	            l = a.length;
	        }

	        for(i = offset; i < l; i += stride) {
	            vec[0] = a[i]; vec[1] = a[i+1];
	            fn(vec, vec, arg);
	            a[i] = vec[0]; a[i+1] = vec[1];
	        }

	        return a;
	    };
	})();

	/**
	 * Returns a string representation of a vector
	 *
	 * @param {vec2} vec vector to represent as a string
	 * @returns {String} string representation of the vector
	 */
	vec2.str = function (a) {
	    return 'vec2(' + a[0] + ', ' + a[1] + ')';
	};

	if(typeof(exports) !== 'undefined') {
	    exports.vec2 = vec2;
	}
	;
	/* Copyright (c) 2013, Brandon Jones, Colin MacKenzie IV. All rights reserved.

	Redistribution and use in source and binary forms, with or without modification,
	are permitted provided that the following conditions are met:

	  * Redistributions of source code must retain the above copyright notice, this
	    list of conditions and the following disclaimer.
	  * Redistributions in binary form must reproduce the above copyright notice,
	    this list of conditions and the following disclaimer in the documentation
	    and/or other materials provided with the distribution.

	THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
	ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
	WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
	DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
	ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
	(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
	LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
	ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
	(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
	SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */

	/**
	 * @class 3 Dimensional Vector
	 * @name vec3
	 */

	var vec3 = {};

	/**
	 * Creates a new, empty vec3
	 *
	 * @returns {vec3} a new 3D vector
	 */
	vec3.create = function() {
	    var out = new GLMAT_ARRAY_TYPE(3);
	    out[0] = 0;
	    out[1] = 0;
	    out[2] = 0;
	    return out;
	};

	/**
	 * Creates a new vec3 initialized with values from an existing vector
	 *
	 * @param {vec3} a vector to clone
	 * @returns {vec3} a new 3D vector
	 */
	vec3.clone = function(a) {
	    var out = new GLMAT_ARRAY_TYPE(3);
	    out[0] = a[0];
	    out[1] = a[1];
	    out[2] = a[2];
	    return out;
	};

	/**
	 * Creates a new vec3 initialized with the given values
	 *
	 * @param {Number} x X component
	 * @param {Number} y Y component
	 * @param {Number} z Z component
	 * @returns {vec3} a new 3D vector
	 */
	vec3.fromValues = function(x, y, z) {
	    var out = new GLMAT_ARRAY_TYPE(3);
	    out[0] = x;
	    out[1] = y;
	    out[2] = z;
	    return out;
	};

	/**
	 * Copy the values from one vec3 to another
	 *
	 * @param {vec3} out the receiving vector
	 * @param {vec3} a the source vector
	 * @returns {vec3} out
	 */
	vec3.copy = function(out, a) {
	    out[0] = a[0];
	    out[1] = a[1];
	    out[2] = a[2];
	    return out;
	};

	/**
	 * Set the components of a vec3 to the given values
	 *
	 * @param {vec3} out the receiving vector
	 * @param {Number} x X component
	 * @param {Number} y Y component
	 * @param {Number} z Z component
	 * @returns {vec3} out
	 */
	vec3.set = function(out, x, y, z) {
	    out[0] = x;
	    out[1] = y;
	    out[2] = z;
	    return out;
	};

	/**
	 * Adds two vec3's
	 *
	 * @param {vec3} out the receiving vector
	 * @param {vec3} a the first operand
	 * @param {vec3} b the second operand
	 * @returns {vec3} out
	 */
	vec3.add = function(out, a, b) {
	    out[0] = a[0] + b[0];
	    out[1] = a[1] + b[1];
	    out[2] = a[2] + b[2];
	    return out;
	};

	/**
	 * Subtracts vector b from vector a
	 *
	 * @param {vec3} out the receiving vector
	 * @param {vec3} a the first operand
	 * @param {vec3} b the second operand
	 * @returns {vec3} out
	 */
	vec3.subtract = function(out, a, b) {
	    out[0] = a[0] - b[0];
	    out[1] = a[1] - b[1];
	    out[2] = a[2] - b[2];
	    return out;
	};

	/**
	 * Alias for {@link vec3.subtract}
	 * @function
	 */
	vec3.sub = vec3.subtract;

	/**
	 * Multiplies two vec3's
	 *
	 * @param {vec3} out the receiving vector
	 * @param {vec3} a the first operand
	 * @param {vec3} b the second operand
	 * @returns {vec3} out
	 */
	vec3.multiply = function(out, a, b) {
	    out[0] = a[0] * b[0];
	    out[1] = a[1] * b[1];
	    out[2] = a[2] * b[2];
	    return out;
	};

	/**
	 * Alias for {@link vec3.multiply}
	 * @function
	 */
	vec3.mul = vec3.multiply;

	/**
	 * Divides two vec3's
	 *
	 * @param {vec3} out the receiving vector
	 * @param {vec3} a the first operand
	 * @param {vec3} b the second operand
	 * @returns {vec3} out
	 */
	vec3.divide = function(out, a, b) {
	    out[0] = a[0] / b[0];
	    out[1] = a[1] / b[1];
	    out[2] = a[2] / b[2];
	    return out;
	};

	/**
	 * Alias for {@link vec3.divide}
	 * @function
	 */
	vec3.div = vec3.divide;

	/**
	 * Returns the minimum of two vec3's
	 *
	 * @param {vec3} out the receiving vector
	 * @param {vec3} a the first operand
	 * @param {vec3} b the second operand
	 * @returns {vec3} out
	 */
	vec3.min = function(out, a, b) {
	    out[0] = Math.min(a[0], b[0]);
	    out[1] = Math.min(a[1], b[1]);
	    out[2] = Math.min(a[2], b[2]);
	    return out;
	};

	/**
	 * Returns the maximum of two vec3's
	 *
	 * @param {vec3} out the receiving vector
	 * @param {vec3} a the first operand
	 * @param {vec3} b the second operand
	 * @returns {vec3} out
	 */
	vec3.max = function(out, a, b) {
	    out[0] = Math.max(a[0], b[0]);
	    out[1] = Math.max(a[1], b[1]);
	    out[2] = Math.max(a[2], b[2]);
	    return out;
	};

	/**
	 * Scales a vec3 by a scalar number
	 *
	 * @param {vec3} out the receiving vector
	 * @param {vec3} a the vector to scale
	 * @param {Number} b amount to scale the vector by
	 * @returns {vec3} out
	 */
	vec3.scale = function(out, a, b) {
	    out[0] = a[0] * b;
	    out[1] = a[1] * b;
	    out[2] = a[2] * b;
	    return out;
	};

	/**
	 * Adds two vec3's after scaling the second operand by a scalar value
	 *
	 * @param {vec3} out the receiving vector
	 * @param {vec3} a the first operand
	 * @param {vec3} b the second operand
	 * @param {Number} scale the amount to scale b by before adding
	 * @returns {vec3} out
	 */
	vec3.scaleAndAdd = function(out, a, b, scale) {
	    out[0] = a[0] + (b[0] * scale);
	    out[1] = a[1] + (b[1] * scale);
	    out[2] = a[2] + (b[2] * scale);
	    return out;
	};

	/**
	 * Calculates the euclidian distance between two vec3's
	 *
	 * @param {vec3} a the first operand
	 * @param {vec3} b the second operand
	 * @returns {Number} distance between a and b
	 */
	vec3.distance = function(a, b) {
	    var x = b[0] - a[0],
	        y = b[1] - a[1],
	        z = b[2] - a[2];
	    return Math.sqrt(x*x + y*y + z*z);
	};

	/**
	 * Alias for {@link vec3.distance}
	 * @function
	 */
	vec3.dist = vec3.distance;

	/**
	 * Calculates the squared euclidian distance between two vec3's
	 *
	 * @param {vec3} a the first operand
	 * @param {vec3} b the second operand
	 * @returns {Number} squared distance between a and b
	 */
	vec3.squaredDistance = function(a, b) {
	    var x = b[0] - a[0],
	        y = b[1] - a[1],
	        z = b[2] - a[2];
	    return x*x + y*y + z*z;
	};

	/**
	 * Alias for {@link vec3.squaredDistance}
	 * @function
	 */
	vec3.sqrDist = vec3.squaredDistance;

	/**
	 * Calculates the length of a vec3
	 *
	 * @param {vec3} a vector to calculate length of
	 * @returns {Number} length of a
	 */
	vec3.length = function (a) {
	    var x = a[0],
	        y = a[1],
	        z = a[2];
	    return Math.sqrt(x*x + y*y + z*z);
	};

	/**
	 * Alias for {@link vec3.length}
	 * @function
	 */
	vec3.len = vec3.length;

	/**
	 * Calculates the squared length of a vec3
	 *
	 * @param {vec3} a vector to calculate squared length of
	 * @returns {Number} squared length of a
	 */
	vec3.squaredLength = function (a) {
	    var x = a[0],
	        y = a[1],
	        z = a[2];
	    return x*x + y*y + z*z;
	};

	/**
	 * Alias for {@link vec3.squaredLength}
	 * @function
	 */
	vec3.sqrLen = vec3.squaredLength;

	/**
	 * Negates the components of a vec3
	 *
	 * @param {vec3} out the receiving vector
	 * @param {vec3} a vector to negate
	 * @returns {vec3} out
	 */
	vec3.negate = function(out, a) {
	    out[0] = -a[0];
	    out[1] = -a[1];
	    out[2] = -a[2];
	    return out;
	};

	/**
	 * Returns the inverse of the components of a vec3
	 *
	 * @param {vec3} out the receiving vector
	 * @param {vec3} a vector to invert
	 * @returns {vec3} out
	 */
	vec3.inverse = function(out, a) {
	  out[0] = 1.0 / a[0];
	  out[1] = 1.0 / a[1];
	  out[2] = 1.0 / a[2];
	  return out;
	};

	/**
	 * Normalize a vec3
	 *
	 * @param {vec3} out the receiving vector
	 * @param {vec3} a vector to normalize
	 * @returns {vec3} out
	 */
	vec3.normalize = function(out, a) {
	    var x = a[0],
	        y = a[1],
	        z = a[2];
	    var len = x*x + y*y + z*z;
	    if (len > 0) {
	        //TODO: evaluate use of glm_invsqrt here?
	        len = 1 / Math.sqrt(len);
	        out[0] = a[0] * len;
	        out[1] = a[1] * len;
	        out[2] = a[2] * len;
	    }
	    return out;
	};

	/**
	 * Calculates the dot product of two vec3's
	 *
	 * @param {vec3} a the first operand
	 * @param {vec3} b the second operand
	 * @returns {Number} dot product of a and b
	 */
	vec3.dot = function (a, b) {
	    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
	};

	/**
	 * Computes the cross product of two vec3's
	 *
	 * @param {vec3} out the receiving vector
	 * @param {vec3} a the first operand
	 * @param {vec3} b the second operand
	 * @returns {vec3} out
	 */
	vec3.cross = function(out, a, b) {
	    var ax = a[0], ay = a[1], az = a[2],
	        bx = b[0], by = b[1], bz = b[2];

	    out[0] = ay * bz - az * by;
	    out[1] = az * bx - ax * bz;
	    out[2] = ax * by - ay * bx;
	    return out;
	};

	/**
	 * Performs a linear interpolation between two vec3's
	 *
	 * @param {vec3} out the receiving vector
	 * @param {vec3} a the first operand
	 * @param {vec3} b the second operand
	 * @param {Number} t interpolation amount between the two inputs
	 * @returns {vec3} out
	 */
	vec3.lerp = function (out, a, b, t) {
	    var ax = a[0],
	        ay = a[1],
	        az = a[2];
	    out[0] = ax + t * (b[0] - ax);
	    out[1] = ay + t * (b[1] - ay);
	    out[2] = az + t * (b[2] - az);
	    return out;
	};

	/**
	 * Generates a random vector with the given scale
	 *
	 * @param {vec3} out the receiving vector
	 * @param {Number} [scale] Length of the resulting vector. If ommitted, a unit vector will be returned
	 * @returns {vec3} out
	 */
	vec3.random = function (out, scale) {
	    scale = scale || 1.0;

	    var r = GLMAT_RANDOM() * 2.0 * Math.PI;
	    var z = (GLMAT_RANDOM() * 2.0) - 1.0;
	    var zScale = Math.sqrt(1.0-z*z) * scale;

	    out[0] = Math.cos(r) * zScale;
	    out[1] = Math.sin(r) * zScale;
	    out[2] = z * scale;
	    return out;
	};

	/**
	 * Transforms the vec3 with a mat4.
	 * 4th vector component is implicitly '1'
	 *
	 * @param {vec3} out the receiving vector
	 * @param {vec3} a the vector to transform
	 * @param {mat4} m matrix to transform with
	 * @returns {vec3} out
	 */
	vec3.transformMat4 = function(out, a, m) {
	    var x = a[0], y = a[1], z = a[2],
	        w = m[3] * x + m[7] * y + m[11] * z + m[15];
	    w = w || 1.0;
	    out[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
	    out[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
	    out[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
	    return out;
	};

	/**
	 * Transforms the vec3 with a mat3.
	 *
	 * @param {vec3} out the receiving vector
	 * @param {vec3} a the vector to transform
	 * @param {mat4} m the 3x3 matrix to transform with
	 * @returns {vec3} out
	 */
	vec3.transformMat3 = function(out, a, m) {
	    var x = a[0], y = a[1], z = a[2];
	    out[0] = x * m[0] + y * m[3] + z * m[6];
	    out[1] = x * m[1] + y * m[4] + z * m[7];
	    out[2] = x * m[2] + y * m[5] + z * m[8];
	    return out;
	};

	/**
	 * Transforms the vec3 with a quat
	 *
	 * @param {vec3} out the receiving vector
	 * @param {vec3} a the vector to transform
	 * @param {quat} q quaternion to transform with
	 * @returns {vec3} out
	 */
	vec3.transformQuat = function(out, a, q) {
	    // benchmarks: http://jsperf.com/quaternion-transform-vec3-implementations

	    var x = a[0], y = a[1], z = a[2],
	        qx = q[0], qy = q[1], qz = q[2], qw = q[3],

	        // calculate quat * vec
	        ix = qw * x + qy * z - qz * y,
	        iy = qw * y + qz * x - qx * z,
	        iz = qw * z + qx * y - qy * x,
	        iw = -qx * x - qy * y - qz * z;

	    // calculate result * inverse quat
	    out[0] = ix * qw + iw * -qx + iy * -qz - iz * -qy;
	    out[1] = iy * qw + iw * -qy + iz * -qx - ix * -qz;
	    out[2] = iz * qw + iw * -qz + ix * -qy - iy * -qx;
	    return out;
	};

	/**
	 * Rotate a 3D vector around the x-axis
	 * @param {vec3} out The receiving vec3
	 * @param {vec3} a The vec3 point to rotate
	 * @param {vec3} b The origin of the rotation
	 * @param {Number} c The angle of rotation
	 * @returns {vec3} out
	 */
	vec3.rotateX = function(out, a, b, c){
	   var p = [], r=[];
	      //Translate point to the origin
	      p[0] = a[0] - b[0];
	      p[1] = a[1] - b[1];
	    p[2] = a[2] - b[2];

	      //perform rotation
	      r[0] = p[0];
	      r[1] = p[1]*Math.cos(c) - p[2]*Math.sin(c);
	      r[2] = p[1]*Math.sin(c) + p[2]*Math.cos(c);

	      //translate to correct position
	      out[0] = r[0] + b[0];
	      out[1] = r[1] + b[1];
	      out[2] = r[2] + b[2];

	    return out;
	};

	/**
	 * Rotate a 3D vector around the y-axis
	 * @param {vec3} out The receiving vec3
	 * @param {vec3} a The vec3 point to rotate
	 * @param {vec3} b The origin of the rotation
	 * @param {Number} c The angle of rotation
	 * @returns {vec3} out
	 */
	vec3.rotateY = function(out, a, b, c){
	    var p = [], r=[];
	    //Translate point to the origin
	    p[0] = a[0] - b[0];
	    p[1] = a[1] - b[1];
	    p[2] = a[2] - b[2];

	    //perform rotation
	    r[0] = p[2]*Math.sin(c) + p[0]*Math.cos(c);
	    r[1] = p[1];
	    r[2] = p[2]*Math.cos(c) - p[0]*Math.sin(c);

	    //translate to correct position
	    out[0] = r[0] + b[0];
	    out[1] = r[1] + b[1];
	    out[2] = r[2] + b[2];

	    return out;
	};

	/**
	 * Rotate a 3D vector around the z-axis
	 * @param {vec3} out The receiving vec3
	 * @param {vec3} a The vec3 point to rotate
	 * @param {vec3} b The origin of the rotation
	 * @param {Number} c The angle of rotation
	 * @returns {vec3} out
	 */
	vec3.rotateZ = function(out, a, b, c){
	    var p = [], r=[];
	    //Translate point to the origin
	    p[0] = a[0] - b[0];
	    p[1] = a[1] - b[1];
	    p[2] = a[2] - b[2];

	    //perform rotation
	    r[0] = p[0]*Math.cos(c) - p[1]*Math.sin(c);
	    r[1] = p[0]*Math.sin(c) + p[1]*Math.cos(c);
	    r[2] = p[2];

	    //translate to correct position
	    out[0] = r[0] + b[0];
	    out[1] = r[1] + b[1];
	    out[2] = r[2] + b[2];

	    return out;
	};

	/**
	 * Perform some operation over an array of vec3s.
	 *
	 * @param {Array} a the array of vectors to iterate over
	 * @param {Number} stride Number of elements between the start of each vec3. If 0 assumes tightly packed
	 * @param {Number} offset Number of elements to skip at the beginning of the array
	 * @param {Number} count Number of vec3s to iterate over. If 0 iterates over entire array
	 * @param {Function} fn Function to call for each vector in the array
	 * @param {Object} [arg] additional argument to pass to fn
	 * @returns {Array} a
	 * @function
	 */
	vec3.forEach = (function() {
	    var vec = vec3.create();

	    return function(a, stride, offset, count, fn, arg) {
	        var i, l;
	        if(!stride) {
	            stride = 3;
	        }

	        if(!offset) {
	            offset = 0;
	        }

	        if(count) {
	            l = Math.min((count * stride) + offset, a.length);
	        } else {
	            l = a.length;
	        }

	        for(i = offset; i < l; i += stride) {
	            vec[0] = a[i]; vec[1] = a[i+1]; vec[2] = a[i+2];
	            fn(vec, vec, arg);
	            a[i] = vec[0]; a[i+1] = vec[1]; a[i+2] = vec[2];
	        }

	        return a;
	    };
	})();

	/**
	 * Get the angle between two 3D vectors
	 * @param {vec3} a The first operand
	 * @param {vec3} b The second operand
	 * @returns {Number} The angle in radians
	 */
	vec3.angle = function(a, b) {

	    var tempA = vec3.fromValues(a[0], a[1], a[2]);
	    var tempB = vec3.fromValues(b[0], b[1], b[2]);

	    vec3.normalize(tempA, tempA);
	    vec3.normalize(tempB, tempB);

	    var cosine = vec3.dot(tempA, tempB);

	    if(cosine > 1.0){
	        return 0;
	    } else {
	        return Math.acos(cosine);
	    }
	};

	/**
	 * Returns a string representation of a vector
	 *
	 * @param {vec3} vec vector to represent as a string
	 * @returns {String} string representation of the vector
	 */
	vec3.str = function (a) {
	    return 'vec3(' + a[0] + ', ' + a[1] + ', ' + a[2] + ')';
	};

	if(typeof(exports) !== 'undefined') {
	    exports.vec3 = vec3;
	}
	;
	/* Copyright (c) 2013, Brandon Jones, Colin MacKenzie IV. All rights reserved.

	Redistribution and use in source and binary forms, with or without modification,
	are permitted provided that the following conditions are met:

	  * Redistributions of source code must retain the above copyright notice, this
	    list of conditions and the following disclaimer.
	  * Redistributions in binary form must reproduce the above copyright notice,
	    this list of conditions and the following disclaimer in the documentation
	    and/or other materials provided with the distribution.

	THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
	ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
	WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
	DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
	ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
	(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
	LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
	ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
	(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
	SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */

	/**
	 * @class 4 Dimensional Vector
	 * @name vec4
	 */

	var vec4 = {};

	/**
	 * Creates a new, empty vec4
	 *
	 * @returns {vec4} a new 4D vector
	 */
	vec4.create = function() {
	    var out = new GLMAT_ARRAY_TYPE(4);
	    out[0] = 0;
	    out[1] = 0;
	    out[2] = 0;
	    out[3] = 0;
	    return out;
	};

	/**
	 * Creates a new vec4 initialized with values from an existing vector
	 *
	 * @param {vec4} a vector to clone
	 * @returns {vec4} a new 4D vector
	 */
	vec4.clone = function(a) {
	    var out = new GLMAT_ARRAY_TYPE(4);
	    out[0] = a[0];
	    out[1] = a[1];
	    out[2] = a[2];
	    out[3] = a[3];
	    return out;
	};

	/**
	 * Creates a new vec4 initialized with the given values
	 *
	 * @param {Number} x X component
	 * @param {Number} y Y component
	 * @param {Number} z Z component
	 * @param {Number} w W component
	 * @returns {vec4} a new 4D vector
	 */
	vec4.fromValues = function(x, y, z, w) {
	    var out = new GLMAT_ARRAY_TYPE(4);
	    out[0] = x;
	    out[1] = y;
	    out[2] = z;
	    out[3] = w;
	    return out;
	};

	/**
	 * Copy the values from one vec4 to another
	 *
	 * @param {vec4} out the receiving vector
	 * @param {vec4} a the source vector
	 * @returns {vec4} out
	 */
	vec4.copy = function(out, a) {
	    out[0] = a[0];
	    out[1] = a[1];
	    out[2] = a[2];
	    out[3] = a[3];
	    return out;
	};

	/**
	 * Set the components of a vec4 to the given values
	 *
	 * @param {vec4} out the receiving vector
	 * @param {Number} x X component
	 * @param {Number} y Y component
	 * @param {Number} z Z component
	 * @param {Number} w W component
	 * @returns {vec4} out
	 */
	vec4.set = function(out, x, y, z, w) {
	    out[0] = x;
	    out[1] = y;
	    out[2] = z;
	    out[3] = w;
	    return out;
	};

	/**
	 * Adds two vec4's
	 *
	 * @param {vec4} out the receiving vector
	 * @param {vec4} a the first operand
	 * @param {vec4} b the second operand
	 * @returns {vec4} out
	 */
	vec4.add = function(out, a, b) {
	    out[0] = a[0] + b[0];
	    out[1] = a[1] + b[1];
	    out[2] = a[2] + b[2];
	    out[3] = a[3] + b[3];
	    return out;
	};

	/**
	 * Subtracts vector b from vector a
	 *
	 * @param {vec4} out the receiving vector
	 * @param {vec4} a the first operand
	 * @param {vec4} b the second operand
	 * @returns {vec4} out
	 */
	vec4.subtract = function(out, a, b) {
	    out[0] = a[0] - b[0];
	    out[1] = a[1] - b[1];
	    out[2] = a[2] - b[2];
	    out[3] = a[3] - b[3];
	    return out;
	};

	/**
	 * Alias for {@link vec4.subtract}
	 * @function
	 */
	vec4.sub = vec4.subtract;

	/**
	 * Multiplies two vec4's
	 *
	 * @param {vec4} out the receiving vector
	 * @param {vec4} a the first operand
	 * @param {vec4} b the second operand
	 * @returns {vec4} out
	 */
	vec4.multiply = function(out, a, b) {
	    out[0] = a[0] * b[0];
	    out[1] = a[1] * b[1];
	    out[2] = a[2] * b[2];
	    out[3] = a[3] * b[3];
	    return out;
	};

	/**
	 * Alias for {@link vec4.multiply}
	 * @function
	 */
	vec4.mul = vec4.multiply;

	/**
	 * Divides two vec4's
	 *
	 * @param {vec4} out the receiving vector
	 * @param {vec4} a the first operand
	 * @param {vec4} b the second operand
	 * @returns {vec4} out
	 */
	vec4.divide = function(out, a, b) {
	    out[0] = a[0] / b[0];
	    out[1] = a[1] / b[1];
	    out[2] = a[2] / b[2];
	    out[3] = a[3] / b[3];
	    return out;
	};

	/**
	 * Alias for {@link vec4.divide}
	 * @function
	 */
	vec4.div = vec4.divide;

	/**
	 * Returns the minimum of two vec4's
	 *
	 * @param {vec4} out the receiving vector
	 * @param {vec4} a the first operand
	 * @param {vec4} b the second operand
	 * @returns {vec4} out
	 */
	vec4.min = function(out, a, b) {
	    out[0] = Math.min(a[0], b[0]);
	    out[1] = Math.min(a[1], b[1]);
	    out[2] = Math.min(a[2], b[2]);
	    out[3] = Math.min(a[3], b[3]);
	    return out;
	};

	/**
	 * Returns the maximum of two vec4's
	 *
	 * @param {vec4} out the receiving vector
	 * @param {vec4} a the first operand
	 * @param {vec4} b the second operand
	 * @returns {vec4} out
	 */
	vec4.max = function(out, a, b) {
	    out[0] = Math.max(a[0], b[0]);
	    out[1] = Math.max(a[1], b[1]);
	    out[2] = Math.max(a[2], b[2]);
	    out[3] = Math.max(a[3], b[3]);
	    return out;
	};

	/**
	 * Scales a vec4 by a scalar number
	 *
	 * @param {vec4} out the receiving vector
	 * @param {vec4} a the vector to scale
	 * @param {Number} b amount to scale the vector by
	 * @returns {vec4} out
	 */
	vec4.scale = function(out, a, b) {
	    out[0] = a[0] * b;
	    out[1] = a[1] * b;
	    out[2] = a[2] * b;
	    out[3] = a[3] * b;
	    return out;
	};

	/**
	 * Adds two vec4's after scaling the second operand by a scalar value
	 *
	 * @param {vec4} out the receiving vector
	 * @param {vec4} a the first operand
	 * @param {vec4} b the second operand
	 * @param {Number} scale the amount to scale b by before adding
	 * @returns {vec4} out
	 */
	vec4.scaleAndAdd = function(out, a, b, scale) {
	    out[0] = a[0] + (b[0] * scale);
	    out[1] = a[1] + (b[1] * scale);
	    out[2] = a[2] + (b[2] * scale);
	    out[3] = a[3] + (b[3] * scale);
	    return out;
	};

	/**
	 * Calculates the euclidian distance between two vec4's
	 *
	 * @param {vec4} a the first operand
	 * @param {vec4} b the second operand
	 * @returns {Number} distance between a and b
	 */
	vec4.distance = function(a, b) {
	    var x = b[0] - a[0],
	        y = b[1] - a[1],
	        z = b[2] - a[2],
	        w = b[3] - a[3];
	    return Math.sqrt(x*x + y*y + z*z + w*w);
	};

	/**
	 * Alias for {@link vec4.distance}
	 * @function
	 */
	vec4.dist = vec4.distance;

	/**
	 * Calculates the squared euclidian distance between two vec4's
	 *
	 * @param {vec4} a the first operand
	 * @param {vec4} b the second operand
	 * @returns {Number} squared distance between a and b
	 */
	vec4.squaredDistance = function(a, b) {
	    var x = b[0] - a[0],
	        y = b[1] - a[1],
	        z = b[2] - a[2],
	        w = b[3] - a[3];
	    return x*x + y*y + z*z + w*w;
	};

	/**
	 * Alias for {@link vec4.squaredDistance}
	 * @function
	 */
	vec4.sqrDist = vec4.squaredDistance;

	/**
	 * Calculates the length of a vec4
	 *
	 * @param {vec4} a vector to calculate length of
	 * @returns {Number} length of a
	 */
	vec4.length = function (a) {
	    var x = a[0],
	        y = a[1],
	        z = a[2],
	        w = a[3];
	    return Math.sqrt(x*x + y*y + z*z + w*w);
	};

	/**
	 * Alias for {@link vec4.length}
	 * @function
	 */
	vec4.len = vec4.length;

	/**
	 * Calculates the squared length of a vec4
	 *
	 * @param {vec4} a vector to calculate squared length of
	 * @returns {Number} squared length of a
	 */
	vec4.squaredLength = function (a) {
	    var x = a[0],
	        y = a[1],
	        z = a[2],
	        w = a[3];
	    return x*x + y*y + z*z + w*w;
	};

	/**
	 * Alias for {@link vec4.squaredLength}
	 * @function
	 */
	vec4.sqrLen = vec4.squaredLength;

	/**
	 * Negates the components of a vec4
	 *
	 * @param {vec4} out the receiving vector
	 * @param {vec4} a vector to negate
	 * @returns {vec4} out
	 */
	vec4.negate = function(out, a) {
	    out[0] = -a[0];
	    out[1] = -a[1];
	    out[2] = -a[2];
	    out[3] = -a[3];
	    return out;
	};

	/**
	 * Returns the inverse of the components of a vec4
	 *
	 * @param {vec4} out the receiving vector
	 * @param {vec4} a vector to invert
	 * @returns {vec4} out
	 */
	vec4.inverse = function(out, a) {
	  out[0] = 1.0 / a[0];
	  out[1] = 1.0 / a[1];
	  out[2] = 1.0 / a[2];
	  out[3] = 1.0 / a[3];
	  return out;
	};

	/**
	 * Normalize a vec4
	 *
	 * @param {vec4} out the receiving vector
	 * @param {vec4} a vector to normalize
	 * @returns {vec4} out
	 */
	vec4.normalize = function(out, a) {
	    var x = a[0],
	        y = a[1],
	        z = a[2],
	        w = a[3];
	    var len = x*x + y*y + z*z + w*w;
	    if (len > 0) {
	        len = 1 / Math.sqrt(len);
	        out[0] = a[0] * len;
	        out[1] = a[1] * len;
	        out[2] = a[2] * len;
	        out[3] = a[3] * len;
	    }
	    return out;
	};

	/**
	 * Calculates the dot product of two vec4's
	 *
	 * @param {vec4} a the first operand
	 * @param {vec4} b the second operand
	 * @returns {Number} dot product of a and b
	 */
	vec4.dot = function (a, b) {
	    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
	};

	/**
	 * Performs a linear interpolation between two vec4's
	 *
	 * @param {vec4} out the receiving vector
	 * @param {vec4} a the first operand
	 * @param {vec4} b the second operand
	 * @param {Number} t interpolation amount between the two inputs
	 * @returns {vec4} out
	 */
	vec4.lerp = function (out, a, b, t) {
	    var ax = a[0],
	        ay = a[1],
	        az = a[2],
	        aw = a[3];
	    out[0] = ax + t * (b[0] - ax);
	    out[1] = ay + t * (b[1] - ay);
	    out[2] = az + t * (b[2] - az);
	    out[3] = aw + t * (b[3] - aw);
	    return out;
	};

	/**
	 * Generates a random vector with the given scale
	 *
	 * @param {vec4} out the receiving vector
	 * @param {Number} [scale] Length of the resulting vector. If ommitted, a unit vector will be returned
	 * @returns {vec4} out
	 */
	vec4.random = function (out, scale) {
	    scale = scale || 1.0;

	    //TODO: This is a pretty awful way of doing this. Find something better.
	    out[0] = GLMAT_RANDOM();
	    out[1] = GLMAT_RANDOM();
	    out[2] = GLMAT_RANDOM();
	    out[3] = GLMAT_RANDOM();
	    vec4.normalize(out, out);
	    vec4.scale(out, out, scale);
	    return out;
	};

	/**
	 * Transforms the vec4 with a mat4.
	 *
	 * @param {vec4} out the receiving vector
	 * @param {vec4} a the vector to transform
	 * @param {mat4} m matrix to transform with
	 * @returns {vec4} out
	 */
	vec4.transformMat4 = function(out, a, m) {
	    var x = a[0], y = a[1], z = a[2], w = a[3];
	    out[0] = m[0] * x + m[4] * y + m[8] * z + m[12] * w;
	    out[1] = m[1] * x + m[5] * y + m[9] * z + m[13] * w;
	    out[2] = m[2] * x + m[6] * y + m[10] * z + m[14] * w;
	    out[3] = m[3] * x + m[7] * y + m[11] * z + m[15] * w;
	    return out;
	};

	/**
	 * Transforms the vec4 with a quat
	 *
	 * @param {vec4} out the receiving vector
	 * @param {vec4} a the vector to transform
	 * @param {quat} q quaternion to transform with
	 * @returns {vec4} out
	 */
	vec4.transformQuat = function(out, a, q) {
	    var x = a[0], y = a[1], z = a[2],
	        qx = q[0], qy = q[1], qz = q[2], qw = q[3],

	        // calculate quat * vec
	        ix = qw * x + qy * z - qz * y,
	        iy = qw * y + qz * x - qx * z,
	        iz = qw * z + qx * y - qy * x,
	        iw = -qx * x - qy * y - qz * z;

	    // calculate result * inverse quat
	    out[0] = ix * qw + iw * -qx + iy * -qz - iz * -qy;
	    out[1] = iy * qw + iw * -qy + iz * -qx - ix * -qz;
	    out[2] = iz * qw + iw * -qz + ix * -qy - iy * -qx;
	    return out;
	};

	/**
	 * Perform some operation over an array of vec4s.
	 *
	 * @param {Array} a the array of vectors to iterate over
	 * @param {Number} stride Number of elements between the start of each vec4. If 0 assumes tightly packed
	 * @param {Number} offset Number of elements to skip at the beginning of the array
	 * @param {Number} count Number of vec4s to iterate over. If 0 iterates over entire array
	 * @param {Function} fn Function to call for each vector in the array
	 * @param {Object} [arg] additional argument to pass to fn
	 * @returns {Array} a
	 * @function
	 */
	vec4.forEach = (function() {
	    var vec = vec4.create();

	    return function(a, stride, offset, count, fn, arg) {
	        var i, l;
	        if(!stride) {
	            stride = 4;
	        }

	        if(!offset) {
	            offset = 0;
	        }

	        if(count) {
	            l = Math.min((count * stride) + offset, a.length);
	        } else {
	            l = a.length;
	        }

	        for(i = offset; i < l; i += stride) {
	            vec[0] = a[i]; vec[1] = a[i+1]; vec[2] = a[i+2]; vec[3] = a[i+3];
	            fn(vec, vec, arg);
	            a[i] = vec[0]; a[i+1] = vec[1]; a[i+2] = vec[2]; a[i+3] = vec[3];
	        }

	        return a;
	    };
	})();

	/**
	 * Returns a string representation of a vector
	 *
	 * @param {vec4} vec vector to represent as a string
	 * @returns {String} string representation of the vector
	 */
	vec4.str = function (a) {
	    return 'vec4(' + a[0] + ', ' + a[1] + ', ' + a[2] + ', ' + a[3] + ')';
	};

	if(typeof(exports) !== 'undefined') {
	    exports.vec4 = vec4;
	}
	;
	/* Copyright (c) 2013, Brandon Jones, Colin MacKenzie IV. All rights reserved.

	Redistribution and use in source and binary forms, with or without modification,
	are permitted provided that the following conditions are met:

	  * Redistributions of source code must retain the above copyright notice, this
	    list of conditions and the following disclaimer.
	  * Redistributions in binary form must reproduce the above copyright notice,
	    this list of conditions and the following disclaimer in the documentation
	    and/or other materials provided with the distribution.

	THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
	ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
	WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
	DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
	ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
	(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
	LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
	ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
	(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
	SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */

	/**
	 * @class 2x2 Matrix
	 * @name mat2
	 */

	var mat2 = {};

	/**
	 * Creates a new identity mat2
	 *
	 * @returns {mat2} a new 2x2 matrix
	 */
	mat2.create = function() {
	    var out = new GLMAT_ARRAY_TYPE(4);
	    out[0] = 1;
	    out[1] = 0;
	    out[2] = 0;
	    out[3] = 1;
	    return out;
	};

	/**
	 * Creates a new mat2 initialized with values from an existing matrix
	 *
	 * @param {mat2} a matrix to clone
	 * @returns {mat2} a new 2x2 matrix
	 */
	mat2.clone = function(a) {
	    var out = new GLMAT_ARRAY_TYPE(4);
	    out[0] = a[0];
	    out[1] = a[1];
	    out[2] = a[2];
	    out[3] = a[3];
	    return out;
	};

	/**
	 * Copy the values from one mat2 to another
	 *
	 * @param {mat2} out the receiving matrix
	 * @param {mat2} a the source matrix
	 * @returns {mat2} out
	 */
	mat2.copy = function(out, a) {
	    out[0] = a[0];
	    out[1] = a[1];
	    out[2] = a[2];
	    out[3] = a[3];
	    return out;
	};

	/**
	 * Set a mat2 to the identity matrix
	 *
	 * @param {mat2} out the receiving matrix
	 * @returns {mat2} out
	 */
	mat2.identity = function(out) {
	    out[0] = 1;
	    out[1] = 0;
	    out[2] = 0;
	    out[3] = 1;
	    return out;
	};

	/**
	 * Transpose the values of a mat2
	 *
	 * @param {mat2} out the receiving matrix
	 * @param {mat2} a the source matrix
	 * @returns {mat2} out
	 */
	mat2.transpose = function(out, a) {
	    // If we are transposing ourselves we can skip a few steps but have to cache some values
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

	/**
	 * Inverts a mat2
	 *
	 * @param {mat2} out the receiving matrix
	 * @param {mat2} a the source matrix
	 * @returns {mat2} out
	 */
	mat2.invert = function(out, a) {
	    var a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3],

	        // Calculate the determinant
	        det = a0 * a3 - a2 * a1;

	    if (!det) {
	        return null;
	    }
	    det = 1.0 / det;

	    out[0] =  a3 * det;
	    out[1] = -a1 * det;
	    out[2] = -a2 * det;
	    out[3] =  a0 * det;

	    return out;
	};

	/**
	 * Calculates the adjugate of a mat2
	 *
	 * @param {mat2} out the receiving matrix
	 * @param {mat2} a the source matrix
	 * @returns {mat2} out
	 */
	mat2.adjoint = function(out, a) {
	    // Caching this value is nessecary if out == a
	    var a0 = a[0];
	    out[0] =  a[3];
	    out[1] = -a[1];
	    out[2] = -a[2];
	    out[3] =  a0;

	    return out;
	};

	/**
	 * Calculates the determinant of a mat2
	 *
	 * @param {mat2} a the source matrix
	 * @returns {Number} determinant of a
	 */
	mat2.determinant = function (a) {
	    return a[0] * a[3] - a[2] * a[1];
	};

	/**
	 * Multiplies two mat2's
	 *
	 * @param {mat2} out the receiving matrix
	 * @param {mat2} a the first operand
	 * @param {mat2} b the second operand
	 * @returns {mat2} out
	 */
	mat2.multiply = function (out, a, b) {
	    var a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3];
	    var b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
	    out[0] = a0 * b0 + a2 * b1;
	    out[1] = a1 * b0 + a3 * b1;
	    out[2] = a0 * b2 + a2 * b3;
	    out[3] = a1 * b2 + a3 * b3;
	    return out;
	};

	/**
	 * Alias for {@link mat2.multiply}
	 * @function
	 */
	mat2.mul = mat2.multiply;

	/**
	 * Rotates a mat2 by the given angle
	 *
	 * @param {mat2} out the receiving matrix
	 * @param {mat2} a the matrix to rotate
	 * @param {Number} rad the angle to rotate the matrix by
	 * @returns {mat2} out
	 */
	mat2.rotate = function (out, a, rad) {
	    var a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3],
	        s = Math.sin(rad),
	        c = Math.cos(rad);
	    out[0] = a0 *  c + a2 * s;
	    out[1] = a1 *  c + a3 * s;
	    out[2] = a0 * -s + a2 * c;
	    out[3] = a1 * -s + a3 * c;
	    return out;
	};

	/**
	 * Scales the mat2 by the dimensions in the given vec2
	 *
	 * @param {mat2} out the receiving matrix
	 * @param {mat2} a the matrix to rotate
	 * @param {vec2} v the vec2 to scale the matrix by
	 * @returns {mat2} out
	 **/
	mat2.scale = function(out, a, v) {
	    var a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3],
	        v0 = v[0], v1 = v[1];
	    out[0] = a0 * v0;
	    out[1] = a1 * v0;
	    out[2] = a2 * v1;
	    out[3] = a3 * v1;
	    return out;
	};

	/**
	 * Returns a string representation of a mat2
	 *
	 * @param {mat2} mat matrix to represent as a string
	 * @returns {String} string representation of the matrix
	 */
	mat2.str = function (a) {
	    return 'mat2(' + a[0] + ', ' + a[1] + ', ' + a[2] + ', ' + a[3] + ')';
	};

	/**
	 * Returns Frobenius norm of a mat2
	 *
	 * @param {mat2} a the matrix to calculate Frobenius norm of
	 * @returns {Number} Frobenius norm
	 */
	mat2.frob = function (a) {
	    return(Math.sqrt(Math.pow(a[0], 2) + Math.pow(a[1], 2) + Math.pow(a[2], 2) + Math.pow(a[3], 2)))
	};

	/**
	 * Returns L, D and U matrices (Lower triangular, Diagonal and Upper triangular) by factorizing the input matrix
	 * @param {mat2} L the lower triangular matrix
	 * @param {mat2} D the diagonal matrix
	 * @param {mat2} U the upper triangular matrix
	 * @param {mat2} a the input matrix to factorize
	 */

	mat2.LDU = function (L, D, U, a) {
	    L[2] = a[2]/a[0];
	    U[0] = a[0];
	    U[1] = a[1];
	    U[3] = a[3] - L[2] * U[1];
	    return [L, D, U];
	};

	if(typeof(exports) !== 'undefined') {
	    exports.mat2 = mat2;
	}
	;
	/* Copyright (c) 2013, Brandon Jones, Colin MacKenzie IV. All rights reserved.

	Redistribution and use in source and binary forms, with or without modification,
	are permitted provided that the following conditions are met:

	  * Redistributions of source code must retain the above copyright notice, this
	    list of conditions and the following disclaimer.
	  * Redistributions in binary form must reproduce the above copyright notice,
	    this list of conditions and the following disclaimer in the documentation
	    and/or other materials provided with the distribution.

	THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
	ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
	WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
	DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
	ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
	(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
	LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
	ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
	(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
	SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */

	/**
	 * @class 2x3 Matrix
	 * @name mat2d
	 *
	 * @description
	 * A mat2d contains six elements defined as:
	 * <pre>
	 * [a, c, tx,
	 *  b, d, ty]
	 * </pre>
	 * This is a short form for the 3x3 matrix:
	 * <pre>
	 * [a, c, tx,
	 *  b, d, ty,
	 *  0, 0, 1]
	 * </pre>
	 * The last row is ignored so the array is shorter and operations are faster.
	 */

	var mat2d = {};

	/**
	 * Creates a new identity mat2d
	 *
	 * @returns {mat2d} a new 2x3 matrix
	 */
	mat2d.create = function() {
	    var out = new GLMAT_ARRAY_TYPE(6);
	    out[0] = 1;
	    out[1] = 0;
	    out[2] = 0;
	    out[3] = 1;
	    out[4] = 0;
	    out[5] = 0;
	    return out;
	};

	/**
	 * Creates a new mat2d initialized with values from an existing matrix
	 *
	 * @param {mat2d} a matrix to clone
	 * @returns {mat2d} a new 2x3 matrix
	 */
	mat2d.clone = function(a) {
	    var out = new GLMAT_ARRAY_TYPE(6);
	    out[0] = a[0];
	    out[1] = a[1];
	    out[2] = a[2];
	    out[3] = a[3];
	    out[4] = a[4];
	    out[5] = a[5];
	    return out;
	};

	/**
	 * Copy the values from one mat2d to another
	 *
	 * @param {mat2d} out the receiving matrix
	 * @param {mat2d} a the source matrix
	 * @returns {mat2d} out
	 */
	mat2d.copy = function(out, a) {
	    out[0] = a[0];
	    out[1] = a[1];
	    out[2] = a[2];
	    out[3] = a[3];
	    out[4] = a[4];
	    out[5] = a[5];
	    return out;
	};

	/**
	 * Set a mat2d to the identity matrix
	 *
	 * @param {mat2d} out the receiving matrix
	 * @returns {mat2d} out
	 */
	mat2d.identity = function(out) {
	    out[0] = 1;
	    out[1] = 0;
	    out[2] = 0;
	    out[3] = 1;
	    out[4] = 0;
	    out[5] = 0;
	    return out;
	};

	/**
	 * Inverts a mat2d
	 *
	 * @param {mat2d} out the receiving matrix
	 * @param {mat2d} a the source matrix
	 * @returns {mat2d} out
	 */
	mat2d.invert = function(out, a) {
	    var aa = a[0], ab = a[1], ac = a[2], ad = a[3],
	        atx = a[4], aty = a[5];

	    var det = aa * ad - ab * ac;
	    if(!det){
	        return null;
	    }
	    det = 1.0 / det;

	    out[0] = ad * det;
	    out[1] = -ab * det;
	    out[2] = -ac * det;
	    out[3] = aa * det;
	    out[4] = (ac * aty - ad * atx) * det;
	    out[5] = (ab * atx - aa * aty) * det;
	    return out;
	};

	/**
	 * Calculates the determinant of a mat2d
	 *
	 * @param {mat2d} a the source matrix
	 * @returns {Number} determinant of a
	 */
	mat2d.determinant = function (a) {
	    return a[0] * a[3] - a[1] * a[2];
	};

	/**
	 * Multiplies two mat2d's
	 *
	 * @param {mat2d} out the receiving matrix
	 * @param {mat2d} a the first operand
	 * @param {mat2d} b the second operand
	 * @returns {mat2d} out
	 */
	mat2d.multiply = function (out, a, b) {
	    var a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3], a4 = a[4], a5 = a[5],
	        b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3], b4 = b[4], b5 = b[5];
	    out[0] = a0 * b0 + a2 * b1;
	    out[1] = a1 * b0 + a3 * b1;
	    out[2] = a0 * b2 + a2 * b3;
	    out[3] = a1 * b2 + a3 * b3;
	    out[4] = a0 * b4 + a2 * b5 + a4;
	    out[5] = a1 * b4 + a3 * b5 + a5;
	    return out;
	};

	/**
	 * Alias for {@link mat2d.multiply}
	 * @function
	 */
	mat2d.mul = mat2d.multiply;


	/**
	 * Rotates a mat2d by the given angle
	 *
	 * @param {mat2d} out the receiving matrix
	 * @param {mat2d} a the matrix to rotate
	 * @param {Number} rad the angle to rotate the matrix by
	 * @returns {mat2d} out
	 */
	mat2d.rotate = function (out, a, rad) {
	    var a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3], a4 = a[4], a5 = a[5],
	        s = Math.sin(rad),
	        c = Math.cos(rad);
	    out[0] = a0 *  c + a2 * s;
	    out[1] = a1 *  c + a3 * s;
	    out[2] = a0 * -s + a2 * c;
	    out[3] = a1 * -s + a3 * c;
	    out[4] = a4;
	    out[5] = a5;
	    return out;
	};

	/**
	 * Scales the mat2d by the dimensions in the given vec2
	 *
	 * @param {mat2d} out the receiving matrix
	 * @param {mat2d} a the matrix to translate
	 * @param {vec2} v the vec2 to scale the matrix by
	 * @returns {mat2d} out
	 **/
	mat2d.scale = function(out, a, v) {
	    var a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3], a4 = a[4], a5 = a[5],
	        v0 = v[0], v1 = v[1];
	    out[0] = a0 * v0;
	    out[1] = a1 * v0;
	    out[2] = a2 * v1;
	    out[3] = a3 * v1;
	    out[4] = a4;
	    out[5] = a5;
	    return out;
	};

	/**
	 * Translates the mat2d by the dimensions in the given vec2
	 *
	 * @param {mat2d} out the receiving matrix
	 * @param {mat2d} a the matrix to translate
	 * @param {vec2} v the vec2 to translate the matrix by
	 * @returns {mat2d} out
	 **/
	mat2d.translate = function(out, a, v) {
	    var a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3], a4 = a[4], a5 = a[5],
	        v0 = v[0], v1 = v[1];
	    out[0] = a0;
	    out[1] = a1;
	    out[2] = a2;
	    out[3] = a3;
	    out[4] = a0 * v0 + a2 * v1 + a4;
	    out[5] = a1 * v0 + a3 * v1 + a5;
	    return out;
	};

	/**
	 * Returns a string representation of a mat2d
	 *
	 * @param {mat2d} a matrix to represent as a string
	 * @returns {String} string representation of the matrix
	 */
	mat2d.str = function (a) {
	    return 'mat2d(' + a[0] + ', ' + a[1] + ', ' + a[2] + ', ' +
	                    a[3] + ', ' + a[4] + ', ' + a[5] + ')';
	};

	/**
	 * Returns Frobenius norm of a mat2d
	 *
	 * @param {mat2d} a the matrix to calculate Frobenius norm of
	 * @returns {Number} Frobenius norm
	 */
	mat2d.frob = function (a) {
	    return(Math.sqrt(Math.pow(a[0], 2) + Math.pow(a[1], 2) + Math.pow(a[2], 2) + Math.pow(a[3], 2) + Math.pow(a[4], 2) + Math.pow(a[5], 2) + 1))
	};

	if(typeof(exports) !== 'undefined') {
	    exports.mat2d = mat2d;
	}
	;
	/* Copyright (c) 2013, Brandon Jones, Colin MacKenzie IV. All rights reserved.

	Redistribution and use in source and binary forms, with or without modification,
	are permitted provided that the following conditions are met:

	  * Redistributions of source code must retain the above copyright notice, this
	    list of conditions and the following disclaimer.
	  * Redistributions in binary form must reproduce the above copyright notice,
	    this list of conditions and the following disclaimer in the documentation
	    and/or other materials provided with the distribution.

	THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
	ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
	WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
	DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
	ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
	(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
	LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
	ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
	(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
	SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */

	/**
	 * @class 3x3 Matrix
	 * @name mat3
	 */

	var mat3 = {};

	/**
	 * Creates a new identity mat3
	 *
	 * @returns {mat3} a new 3x3 matrix
	 */
	mat3.create = function() {
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

	/**
	 * Copies the upper-left 3x3 values into the given mat3.
	 *
	 * @param {mat3} out the receiving 3x3 matrix
	 * @param {mat4} a   the source 4x4 matrix
	 * @returns {mat3} out
	 */
	mat3.fromMat4 = function(out, a) {
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

	/**
	 * Creates a new mat3 initialized with values from an existing matrix
	 *
	 * @param {mat3} a matrix to clone
	 * @returns {mat3} a new 3x3 matrix
	 */
	mat3.clone = function(a) {
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

	/**
	 * Copy the values from one mat3 to another
	 *
	 * @param {mat3} out the receiving matrix
	 * @param {mat3} a the source matrix
	 * @returns {mat3} out
	 */
	mat3.copy = function(out, a) {
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

	/**
	 * Set a mat3 to the identity matrix
	 *
	 * @param {mat3} out the receiving matrix
	 * @returns {mat3} out
	 */
	mat3.identity = function(out) {
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

	/**
	 * Transpose the values of a mat3
	 *
	 * @param {mat3} out the receiving matrix
	 * @param {mat3} a the source matrix
	 * @returns {mat3} out
	 */
	mat3.transpose = function(out, a) {
	    // If we are transposing ourselves we can skip a few steps but have to cache some values
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

	/**
	 * Inverts a mat3
	 *
	 * @param {mat3} out the receiving matrix
	 * @param {mat3} a the source matrix
	 * @returns {mat3} out
	 */
	mat3.invert = function(out, a) {
	    var a00 = a[0], a01 = a[1], a02 = a[2],
	        a10 = a[3], a11 = a[4], a12 = a[5],
	        a20 = a[6], a21 = a[7], a22 = a[8],

	        b01 = a22 * a11 - a12 * a21,
	        b11 = -a22 * a10 + a12 * a20,
	        b21 = a21 * a10 - a11 * a20,

	        // Calculate the determinant
	        det = a00 * b01 + a01 * b11 + a02 * b21;

	    if (!det) {
	        return null;
	    }
	    det = 1.0 / det;

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

	/**
	 * Calculates the adjugate of a mat3
	 *
	 * @param {mat3} out the receiving matrix
	 * @param {mat3} a the source matrix
	 * @returns {mat3} out
	 */
	mat3.adjoint = function(out, a) {
	    var a00 = a[0], a01 = a[1], a02 = a[2],
	        a10 = a[3], a11 = a[4], a12 = a[5],
	        a20 = a[6], a21 = a[7], a22 = a[8];

	    out[0] = (a11 * a22 - a12 * a21);
	    out[1] = (a02 * a21 - a01 * a22);
	    out[2] = (a01 * a12 - a02 * a11);
	    out[3] = (a12 * a20 - a10 * a22);
	    out[4] = (a00 * a22 - a02 * a20);
	    out[5] = (a02 * a10 - a00 * a12);
	    out[6] = (a10 * a21 - a11 * a20);
	    out[7] = (a01 * a20 - a00 * a21);
	    out[8] = (a00 * a11 - a01 * a10);
	    return out;
	};

	/**
	 * Calculates the determinant of a mat3
	 *
	 * @param {mat3} a the source matrix
	 * @returns {Number} determinant of a
	 */
	mat3.determinant = function (a) {
	    var a00 = a[0], a01 = a[1], a02 = a[2],
	        a10 = a[3], a11 = a[4], a12 = a[5],
	        a20 = a[6], a21 = a[7], a22 = a[8];

	    return a00 * (a22 * a11 - a12 * a21) + a01 * (-a22 * a10 + a12 * a20) + a02 * (a21 * a10 - a11 * a20);
	};

	/**
	 * Multiplies two mat3's
	 *
	 * @param {mat3} out the receiving matrix
	 * @param {mat3} a the first operand
	 * @param {mat3} b the second operand
	 * @returns {mat3} out
	 */
	mat3.multiply = function (out, a, b) {
	    var a00 = a[0], a01 = a[1], a02 = a[2],
	        a10 = a[3], a11 = a[4], a12 = a[5],
	        a20 = a[6], a21 = a[7], a22 = a[8],

	        b00 = b[0], b01 = b[1], b02 = b[2],
	        b10 = b[3], b11 = b[4], b12 = b[5],
	        b20 = b[6], b21 = b[7], b22 = b[8];

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

	/**
	 * Alias for {@link mat3.multiply}
	 * @function
	 */
	mat3.mul = mat3.multiply;

	/**
	 * Translate a mat3 by the given vector
	 *
	 * @param {mat3} out the receiving matrix
	 * @param {mat3} a the matrix to translate
	 * @param {vec2} v vector to translate by
	 * @returns {mat3} out
	 */
	mat3.translate = function(out, a, v) {
	    var a00 = a[0], a01 = a[1], a02 = a[2],
	        a10 = a[3], a11 = a[4], a12 = a[5],
	        a20 = a[6], a21 = a[7], a22 = a[8],
	        x = v[0], y = v[1];

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

	/**
	 * Rotates a mat3 by the given angle
	 *
	 * @param {mat3} out the receiving matrix
	 * @param {mat3} a the matrix to rotate
	 * @param {Number} rad the angle to rotate the matrix by
	 * @returns {mat3} out
	 */
	mat3.rotate = function (out, a, rad) {
	    var a00 = a[0], a01 = a[1], a02 = a[2],
	        a10 = a[3], a11 = a[4], a12 = a[5],
	        a20 = a[6], a21 = a[7], a22 = a[8],

	        s = Math.sin(rad),
	        c = Math.cos(rad);

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

	/**
	 * Scales the mat3 by the dimensions in the given vec2
	 *
	 * @param {mat3} out the receiving matrix
	 * @param {mat3} a the matrix to rotate
	 * @param {vec2} v the vec2 to scale the matrix by
	 * @returns {mat3} out
	 **/
	mat3.scale = function(out, a, v) {
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

	/**
	 * Copies the values from a mat2d into a mat3
	 *
	 * @param {mat3} out the receiving matrix
	 * @param {mat2d} a the matrix to copy
	 * @returns {mat3} out
	 **/
	mat3.fromMat2d = function(out, a) {
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

	/**
	* Calculates a 3x3 matrix from the given quaternion
	*
	* @param {mat3} out mat3 receiving operation result
	* @param {quat} q Quaternion to create matrix from
	*
	* @returns {mat3} out
	*/
	mat3.fromQuat = function (out, q) {
	    var x = q[0], y = q[1], z = q[2], w = q[3],
	        x2 = x + x,
	        y2 = y + y,
	        z2 = z + z,

	        xx = x * x2,
	        yx = y * x2,
	        yy = y * y2,
	        zx = z * x2,
	        zy = z * y2,
	        zz = z * z2,
	        wx = w * x2,
	        wy = w * y2,
	        wz = w * z2;

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

	/**
	* Calculates a 3x3 normal matrix (transpose inverse) from the 4x4 matrix
	*
	* @param {mat3} out mat3 receiving operation result
	* @param {mat4} a Mat4 to derive the normal matrix from
	*
	* @returns {mat3} out
	*/
	mat3.normalFromMat4 = function (out, a) {
	    var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
	        a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
	        a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
	        a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15],

	        b00 = a00 * a11 - a01 * a10,
	        b01 = a00 * a12 - a02 * a10,
	        b02 = a00 * a13 - a03 * a10,
	        b03 = a01 * a12 - a02 * a11,
	        b04 = a01 * a13 - a03 * a11,
	        b05 = a02 * a13 - a03 * a12,
	        b06 = a20 * a31 - a21 * a30,
	        b07 = a20 * a32 - a22 * a30,
	        b08 = a20 * a33 - a23 * a30,
	        b09 = a21 * a32 - a22 * a31,
	        b10 = a21 * a33 - a23 * a31,
	        b11 = a22 * a33 - a23 * a32,

	        // Calculate the determinant
	        det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

	    if (!det) {
	        return null;
	    }
	    det = 1.0 / det;

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

	/**
	 * Returns a string representation of a mat3
	 *
	 * @param {mat3} mat matrix to represent as a string
	 * @returns {String} string representation of the matrix
	 */
	mat3.str = function (a) {
	    return 'mat3(' + a[0] + ', ' + a[1] + ', ' + a[2] + ', ' +
	                    a[3] + ', ' + a[4] + ', ' + a[5] + ', ' +
	                    a[6] + ', ' + a[7] + ', ' + a[8] + ')';
	};

	/**
	 * Returns Frobenius norm of a mat3
	 *
	 * @param {mat3} a the matrix to calculate Frobenius norm of
	 * @returns {Number} Frobenius norm
	 */
	mat3.frob = function (a) {
	    return(Math.sqrt(Math.pow(a[0], 2) + Math.pow(a[1], 2) + Math.pow(a[2], 2) + Math.pow(a[3], 2) + Math.pow(a[4], 2) + Math.pow(a[5], 2) + Math.pow(a[6], 2) + Math.pow(a[7], 2) + Math.pow(a[8], 2)))
	};


	if(typeof(exports) !== 'undefined') {
	    exports.mat3 = mat3;
	}
	;
	/* Copyright (c) 2013, Brandon Jones, Colin MacKenzie IV. All rights reserved.

	Redistribution and use in source and binary forms, with or without modification,
	are permitted provided that the following conditions are met:

	  * Redistributions of source code must retain the above copyright notice, this
	    list of conditions and the following disclaimer.
	  * Redistributions in binary form must reproduce the above copyright notice,
	    this list of conditions and the following disclaimer in the documentation
	    and/or other materials provided with the distribution.

	THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
	ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
	WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
	DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
	ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
	(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
	LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
	ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
	(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
	SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */

	/**
	 * @class 4x4 Matrix
	 * @name mat4
	 */

	var mat4 = {};

	/**
	 * Creates a new identity mat4
	 *
	 * @returns {mat4} a new 4x4 matrix
	 */
	mat4.create = function() {
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

	/**
	 * Creates a new mat4 initialized with values from an existing matrix
	 *
	 * @param {mat4} a matrix to clone
	 * @returns {mat4} a new 4x4 matrix
	 */
	mat4.clone = function(a) {
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

	/**
	 * Copy the values from one mat4 to another
	 *
	 * @param {mat4} out the receiving matrix
	 * @param {mat4} a the source matrix
	 * @returns {mat4} out
	 */
	mat4.copy = function(out, a) {
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

	/**
	 * Set a mat4 to the identity matrix
	 *
	 * @param {mat4} out the receiving matrix
	 * @returns {mat4} out
	 */
	mat4.identity = function(out) {
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

	/**
	 * Transpose the values of a mat4
	 *
	 * @param {mat4} out the receiving matrix
	 * @param {mat4} a the source matrix
	 * @returns {mat4} out
	 */
	mat4.transpose = function(out, a) {
	    // If we are transposing ourselves we can skip a few steps but have to cache some values
	    if (out === a) {
	        var a01 = a[1], a02 = a[2], a03 = a[3],
	            a12 = a[6], a13 = a[7],
	            a23 = a[11];

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

	/**
	 * Inverts a mat4
	 *
	 * @param {mat4} out the receiving matrix
	 * @param {mat4} a the source matrix
	 * @returns {mat4} out
	 */
	mat4.invert = function(out, a) {
	    var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
	        a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
	        a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
	        a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15],

	        b00 = a00 * a11 - a01 * a10,
	        b01 = a00 * a12 - a02 * a10,
	        b02 = a00 * a13 - a03 * a10,
	        b03 = a01 * a12 - a02 * a11,
	        b04 = a01 * a13 - a03 * a11,
	        b05 = a02 * a13 - a03 * a12,
	        b06 = a20 * a31 - a21 * a30,
	        b07 = a20 * a32 - a22 * a30,
	        b08 = a20 * a33 - a23 * a30,
	        b09 = a21 * a32 - a22 * a31,
	        b10 = a21 * a33 - a23 * a31,
	        b11 = a22 * a33 - a23 * a32,

	        // Calculate the determinant
	        det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

	    if (!det) {
	        return null;
	    }
	    det = 1.0 / det;

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

	/**
	 * Calculates the adjugate of a mat4
	 *
	 * @param {mat4} out the receiving matrix
	 * @param {mat4} a the source matrix
	 * @returns {mat4} out
	 */
	mat4.adjoint = function(out, a) {
	    var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
	        a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
	        a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
	        a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

	    out[0]  =  (a11 * (a22 * a33 - a23 * a32) - a21 * (a12 * a33 - a13 * a32) + a31 * (a12 * a23 - a13 * a22));
	    out[1]  = -(a01 * (a22 * a33 - a23 * a32) - a21 * (a02 * a33 - a03 * a32) + a31 * (a02 * a23 - a03 * a22));
	    out[2]  =  (a01 * (a12 * a33 - a13 * a32) - a11 * (a02 * a33 - a03 * a32) + a31 * (a02 * a13 - a03 * a12));
	    out[3]  = -(a01 * (a12 * a23 - a13 * a22) - a11 * (a02 * a23 - a03 * a22) + a21 * (a02 * a13 - a03 * a12));
	    out[4]  = -(a10 * (a22 * a33 - a23 * a32) - a20 * (a12 * a33 - a13 * a32) + a30 * (a12 * a23 - a13 * a22));
	    out[5]  =  (a00 * (a22 * a33 - a23 * a32) - a20 * (a02 * a33 - a03 * a32) + a30 * (a02 * a23 - a03 * a22));
	    out[6]  = -(a00 * (a12 * a33 - a13 * a32) - a10 * (a02 * a33 - a03 * a32) + a30 * (a02 * a13 - a03 * a12));
	    out[7]  =  (a00 * (a12 * a23 - a13 * a22) - a10 * (a02 * a23 - a03 * a22) + a20 * (a02 * a13 - a03 * a12));
	    out[8]  =  (a10 * (a21 * a33 - a23 * a31) - a20 * (a11 * a33 - a13 * a31) + a30 * (a11 * a23 - a13 * a21));
	    out[9]  = -(a00 * (a21 * a33 - a23 * a31) - a20 * (a01 * a33 - a03 * a31) + a30 * (a01 * a23 - a03 * a21));
	    out[10] =  (a00 * (a11 * a33 - a13 * a31) - a10 * (a01 * a33 - a03 * a31) + a30 * (a01 * a13 - a03 * a11));
	    out[11] = -(a00 * (a11 * a23 - a13 * a21) - a10 * (a01 * a23 - a03 * a21) + a20 * (a01 * a13 - a03 * a11));
	    out[12] = -(a10 * (a21 * a32 - a22 * a31) - a20 * (a11 * a32 - a12 * a31) + a30 * (a11 * a22 - a12 * a21));
	    out[13] =  (a00 * (a21 * a32 - a22 * a31) - a20 * (a01 * a32 - a02 * a31) + a30 * (a01 * a22 - a02 * a21));
	    out[14] = -(a00 * (a11 * a32 - a12 * a31) - a10 * (a01 * a32 - a02 * a31) + a30 * (a01 * a12 - a02 * a11));
	    out[15] =  (a00 * (a11 * a22 - a12 * a21) - a10 * (a01 * a22 - a02 * a21) + a20 * (a01 * a12 - a02 * a11));
	    return out;
	};

	/**
	 * Calculates the determinant of a mat4
	 *
	 * @param {mat4} a the source matrix
	 * @returns {Number} determinant of a
	 */
	mat4.determinant = function (a) {
	    var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
	        a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
	        a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
	        a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15],

	        b00 = a00 * a11 - a01 * a10,
	        b01 = a00 * a12 - a02 * a10,
	        b02 = a00 * a13 - a03 * a10,
	        b03 = a01 * a12 - a02 * a11,
	        b04 = a01 * a13 - a03 * a11,
	        b05 = a02 * a13 - a03 * a12,
	        b06 = a20 * a31 - a21 * a30,
	        b07 = a20 * a32 - a22 * a30,
	        b08 = a20 * a33 - a23 * a30,
	        b09 = a21 * a32 - a22 * a31,
	        b10 = a21 * a33 - a23 * a31,
	        b11 = a22 * a33 - a23 * a32;

	    // Calculate the determinant
	    return b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
	};

	/**
	 * Multiplies two mat4's
	 *
	 * @param {mat4} out the receiving matrix
	 * @param {mat4} a the first operand
	 * @param {mat4} b the second operand
	 * @returns {mat4} out
	 */
	mat4.multiply = function (out, a, b) {
	    var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
	        a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
	        a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
	        a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

	    // Cache only the current line of the second matrix
	    var b0  = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
	    out[0] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
	    out[1] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
	    out[2] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
	    out[3] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

	    b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
	    out[4] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
	    out[5] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
	    out[6] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
	    out[7] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

	    b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
	    out[8] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
	    out[9] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
	    out[10] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
	    out[11] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

	    b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
	    out[12] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
	    out[13] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
	    out[14] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
	    out[15] = b0*a03 + b1*a13 + b2*a23 + b3*a33;
	    return out;
	};

	/**
	 * Multiplies two affine mat4's
	 * Add by https://github.com/pissang
	 * @param {mat4} out the receiving matrix
	 * @param {mat4} a the first operand
	 * @param {mat4} b the second operand
	 * @returns {mat4} out
	 */
	mat4.multiplyAffine = function (out, a, b) {
	    var a00 = a[0], a01 = a[1], a02 = a[2],
	        a10 = a[4], a11 = a[5], a12 = a[6],
	        a20 = a[8], a21 = a[9], a22 = a[10],
	        a30 = a[12], a31 = a[13], a32 = a[14];

	    // Cache only the current line of the second matrix
	    var b0  = b[0], b1 = b[1], b2 = b[2];
	    out[0] = b0*a00 + b1*a10 + b2*a20;
	    out[1] = b0*a01 + b1*a11 + b2*a21;
	    out[2] = b0*a02 + b1*a12 + b2*a22;
	    // out[3] = 0;

	    b0 = b[4]; b1 = b[5]; b2 = b[6];
	    out[4] = b0*a00 + b1*a10 + b2*a20;
	    out[5] = b0*a01 + b1*a11 + b2*a21;
	    out[6] = b0*a02 + b1*a12 + b2*a22;
	    // out[7] = 0;

	    b0 = b[8]; b1 = b[9]; b2 = b[10];
	    out[8] = b0*a00 + b1*a10 + b2*a20;
	    out[9] = b0*a01 + b1*a11 + b2*a21;
	    out[10] = b0*a02 + b1*a12 + b2*a22;
	    // out[11] = 0;

	    b0 = b[12]; b1 = b[13]; b2 = b[14];
	    out[12] = b0*a00 + b1*a10 + b2*a20 + a30;
	    out[13] = b0*a01 + b1*a11 + b2*a21 + a31;
	    out[14] = b0*a02 + b1*a12 + b2*a22 + a32;
	    // out[15] = 1;
	    return out;
	};

	/**
	 * Alias for {@link mat4.multiply}
	 * @function
	 */
	mat4.mul = mat4.multiply;

	/**
	 * Alias for {@link mat4.multiplyAffine}
	 * @function
	 */
	mat4.mulAffine = mat4.multiplyAffine;
	/**
	 * Translate a mat4 by the given vector
	 *
	 * @param {mat4} out the receiving matrix
	 * @param {mat4} a the matrix to translate
	 * @param {vec3} v vector to translate by
	 * @returns {mat4} out
	 */
	mat4.translate = function (out, a, v) {
	    var x = v[0], y = v[1], z = v[2],
	        a00, a01, a02, a03,
	        a10, a11, a12, a13,
	        a20, a21, a22, a23;

	    if (a === out) {
	        out[12] = a[0] * x + a[4] * y + a[8] * z + a[12];
	        out[13] = a[1] * x + a[5] * y + a[9] * z + a[13];
	        out[14] = a[2] * x + a[6] * y + a[10] * z + a[14];
	        out[15] = a[3] * x + a[7] * y + a[11] * z + a[15];
	    } else {
	        a00 = a[0]; a01 = a[1]; a02 = a[2]; a03 = a[3];
	        a10 = a[4]; a11 = a[5]; a12 = a[6]; a13 = a[7];
	        a20 = a[8]; a21 = a[9]; a22 = a[10]; a23 = a[11];

	        out[0] = a00; out[1] = a01; out[2] = a02; out[3] = a03;
	        out[4] = a10; out[5] = a11; out[6] = a12; out[7] = a13;
	        out[8] = a20; out[9] = a21; out[10] = a22; out[11] = a23;

	        out[12] = a00 * x + a10 * y + a20 * z + a[12];
	        out[13] = a01 * x + a11 * y + a21 * z + a[13];
	        out[14] = a02 * x + a12 * y + a22 * z + a[14];
	        out[15] = a03 * x + a13 * y + a23 * z + a[15];
	    }

	    return out;
	};

	/**
	 * Scales the mat4 by the dimensions in the given vec3
	 *
	 * @param {mat4} out the receiving matrix
	 * @param {mat4} a the matrix to scale
	 * @param {vec3} v the vec3 to scale the matrix by
	 * @returns {mat4} out
	 **/
	mat4.scale = function(out, a, v) {
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

	/**
	 * Rotates a mat4 by the given angle
	 *
	 * @param {mat4} out the receiving matrix
	 * @param {mat4} a the matrix to rotate
	 * @param {Number} rad the angle to rotate the matrix by
	 * @param {vec3} axis the axis to rotate around
	 * @returns {mat4} out
	 */
	mat4.rotate = function (out, a, rad, axis) {
	    var x = axis[0], y = axis[1], z = axis[2],
	        len = Math.sqrt(x * x + y * y + z * z),
	        s, c, t,
	        a00, a01, a02, a03,
	        a10, a11, a12, a13,
	        a20, a21, a22, a23,
	        b00, b01, b02,
	        b10, b11, b12,
	        b20, b21, b22;

	    if (Math.abs(len) < GLMAT_EPSILON) { return null; }

	    len = 1 / len;
	    x *= len;
	    y *= len;
	    z *= len;

	    s = Math.sin(rad);
	    c = Math.cos(rad);
	    t = 1 - c;

	    a00 = a[0]; a01 = a[1]; a02 = a[2]; a03 = a[3];
	    a10 = a[4]; a11 = a[5]; a12 = a[6]; a13 = a[7];
	    a20 = a[8]; a21 = a[9]; a22 = a[10]; a23 = a[11];

	    // Construct the elements of the rotation matrix
	    b00 = x * x * t + c; b01 = y * x * t + z * s; b02 = z * x * t - y * s;
	    b10 = x * y * t - z * s; b11 = y * y * t + c; b12 = z * y * t + x * s;
	    b20 = x * z * t + y * s; b21 = y * z * t - x * s; b22 = z * z * t + c;

	    // Perform rotation-specific matrix multiplication
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

	    if (a !== out) { // If the source and destination differ, copy the unchanged last row
	        out[12] = a[12];
	        out[13] = a[13];
	        out[14] = a[14];
	        out[15] = a[15];
	    }
	    return out;
	};

	/**
	 * Rotates a matrix by the given angle around the X axis
	 *
	 * @param {mat4} out the receiving matrix
	 * @param {mat4} a the matrix to rotate
	 * @param {Number} rad the angle to rotate the matrix by
	 * @returns {mat4} out
	 */
	mat4.rotateX = function (out, a, rad) {
	    var s = Math.sin(rad),
	        c = Math.cos(rad),
	        a10 = a[4],
	        a11 = a[5],
	        a12 = a[6],
	        a13 = a[7],
	        a20 = a[8],
	        a21 = a[9],
	        a22 = a[10],
	        a23 = a[11];

	    if (a !== out) { // If the source and destination differ, copy the unchanged rows
	        out[0]  = a[0];
	        out[1]  = a[1];
	        out[2]  = a[2];
	        out[3]  = a[3];
	        out[12] = a[12];
	        out[13] = a[13];
	        out[14] = a[14];
	        out[15] = a[15];
	    }

	    // Perform axis-specific matrix multiplication
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

	/**
	 * Rotates a matrix by the given angle around the Y axis
	 *
	 * @param {mat4} out the receiving matrix
	 * @param {mat4} a the matrix to rotate
	 * @param {Number} rad the angle to rotate the matrix by
	 * @returns {mat4} out
	 */
	mat4.rotateY = function (out, a, rad) {
	    var s = Math.sin(rad),
	        c = Math.cos(rad),
	        a00 = a[0],
	        a01 = a[1],
	        a02 = a[2],
	        a03 = a[3],
	        a20 = a[8],
	        a21 = a[9],
	        a22 = a[10],
	        a23 = a[11];

	    if (a !== out) { // If the source and destination differ, copy the unchanged rows
	        out[4]  = a[4];
	        out[5]  = a[5];
	        out[6]  = a[6];
	        out[7]  = a[7];
	        out[12] = a[12];
	        out[13] = a[13];
	        out[14] = a[14];
	        out[15] = a[15];
	    }

	    // Perform axis-specific matrix multiplication
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

	/**
	 * Rotates a matrix by the given angle around the Z axis
	 *
	 * @param {mat4} out the receiving matrix
	 * @param {mat4} a the matrix to rotate
	 * @param {Number} rad the angle to rotate the matrix by
	 * @returns {mat4} out
	 */
	mat4.rotateZ = function (out, a, rad) {
	    var s = Math.sin(rad),
	        c = Math.cos(rad),
	        a00 = a[0],
	        a01 = a[1],
	        a02 = a[2],
	        a03 = a[3],
	        a10 = a[4],
	        a11 = a[5],
	        a12 = a[6],
	        a13 = a[7];

	    if (a !== out) { // If the source and destination differ, copy the unchanged last row
	        out[8]  = a[8];
	        out[9]  = a[9];
	        out[10] = a[10];
	        out[11] = a[11];
	        out[12] = a[12];
	        out[13] = a[13];
	        out[14] = a[14];
	        out[15] = a[15];
	    }

	    // Perform axis-specific matrix multiplication
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

	/**
	 * Creates a matrix from a quaternion rotation and vector translation
	 * This is equivalent to (but much faster than):
	 *
	 *     mat4.identity(dest);
	 *     mat4.translate(dest, vec);
	 *     var quatMat = mat4.create();
	 *     quat4.toMat4(quat, quatMat);
	 *     mat4.multiply(dest, quatMat);
	 *
	 * @param {mat4} out mat4 receiving operation result
	 * @param {quat4} q Rotation quaternion
	 * @param {vec3} v Translation vector
	 * @returns {mat4} out
	 */
	mat4.fromRotationTranslation = function (out, q, v) {
	    // Quaternion math
	    var x = q[0], y = q[1], z = q[2], w = q[3],
	        x2 = x + x,
	        y2 = y + y,
	        z2 = z + z,

	        xx = x * x2,
	        xy = x * y2,
	        xz = x * z2,
	        yy = y * y2,
	        yz = y * z2,
	        zz = z * z2,
	        wx = w * x2,
	        wy = w * y2,
	        wz = w * z2;

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
	    var x = q[0], y = q[1], z = q[2], w = q[3],
	        x2 = x + x,
	        y2 = y + y,
	        z2 = z + z,

	        xx = x * x2,
	        yx = y * x2,
	        yy = y * y2,
	        zx = z * x2,
	        zy = z * y2,
	        zz = z * z2,
	        wx = w * x2,
	        wy = w * y2,
	        wz = w * z2;

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

	/**
	 * Generates a frustum matrix with the given bounds
	 *
	 * @param {mat4} out mat4 frustum matrix will be written into
	 * @param {Number} left Left bound of the frustum
	 * @param {Number} right Right bound of the frustum
	 * @param {Number} bottom Bottom bound of the frustum
	 * @param {Number} top Top bound of the frustum
	 * @param {Number} near Near bound of the frustum
	 * @param {Number} far Far bound of the frustum
	 * @returns {mat4} out
	 */
	mat4.frustum = function (out, left, right, bottom, top, near, far) {
	    var rl = 1 / (right - left),
	        tb = 1 / (top - bottom),
	        nf = 1 / (near - far);
	    out[0] = (near * 2) * rl;
	    out[1] = 0;
	    out[2] = 0;
	    out[3] = 0;
	    out[4] = 0;
	    out[5] = (near * 2) * tb;
	    out[6] = 0;
	    out[7] = 0;
	    out[8] = (right + left) * rl;
	    out[9] = (top + bottom) * tb;
	    out[10] = (far + near) * nf;
	    out[11] = -1;
	    out[12] = 0;
	    out[13] = 0;
	    out[14] = (far * near * 2) * nf;
	    out[15] = 0;
	    return out;
	};

	/**
	 * Generates a perspective projection matrix with the given bounds
	 *
	 * @param {mat4} out mat4 frustum matrix will be written into
	 * @param {number} fovy Vertical field of view in radians
	 * @param {number} aspect Aspect ratio. typically viewport width/height
	 * @param {number} near Near bound of the frustum
	 * @param {number} far Far bound of the frustum
	 * @returns {mat4} out
	 */
	mat4.perspective = function (out, fovy, aspect, near, far) {
	    var f = 1.0 / Math.tan(fovy / 2),
	        nf = 1 / (near - far);
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
	    out[14] = (2 * far * near) * nf;
	    out[15] = 0;
	    return out;
	};

	/**
	 * Generates a orthogonal projection matrix with the given bounds
	 *
	 * @param {mat4} out mat4 frustum matrix will be written into
	 * @param {number} left Left bound of the frustum
	 * @param {number} right Right bound of the frustum
	 * @param {number} bottom Bottom bound of the frustum
	 * @param {number} top Top bound of the frustum
	 * @param {number} near Near bound of the frustum
	 * @param {number} far Far bound of the frustum
	 * @returns {mat4} out
	 */
	mat4.ortho = function (out, left, right, bottom, top, near, far) {
	    var lr = 1 / (left - right),
	        bt = 1 / (bottom - top),
	        nf = 1 / (near - far);
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

	/**
	 * Generates a look-at matrix with the given eye position, focal point, and up axis
	 *
	 * @param {mat4} out mat4 frustum matrix will be written into
	 * @param {vec3} eye Position of the viewer
	 * @param {vec3} center Point the viewer is looking at
	 * @param {vec3} up vec3 pointing up
	 * @returns {mat4} out
	 */
	mat4.lookAt = function (out, eye, center, up) {
	    var x0, x1, x2, y0, y1, y2, z0, z1, z2, len,
	        eyex = eye[0],
	        eyey = eye[1],
	        eyez = eye[2],
	        upx = up[0],
	        upy = up[1],
	        upz = up[2],
	        centerx = center[0],
	        centery = center[1],
	        centerz = center[2];

	    if (Math.abs(eyex - centerx) < GLMAT_EPSILON &&
	        Math.abs(eyey - centery) < GLMAT_EPSILON &&
	        Math.abs(eyez - centerz) < GLMAT_EPSILON) {
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

	/**
	 * Returns a string representation of a mat4
	 *
	 * @param {mat4} mat matrix to represent as a string
	 * @returns {String} string representation of the matrix
	 */
	mat4.str = function (a) {
	    return 'mat4(' + a[0] + ', ' + a[1] + ', ' + a[2] + ', ' + a[3] + ', ' +
	                    a[4] + ', ' + a[5] + ', ' + a[6] + ', ' + a[7] + ', ' +
	                    a[8] + ', ' + a[9] + ', ' + a[10] + ', ' + a[11] + ', ' +
	                    a[12] + ', ' + a[13] + ', ' + a[14] + ', ' + a[15] + ')';
	};

	/**
	 * Returns Frobenius norm of a mat4
	 *
	 * @param {mat4} a the matrix to calculate Frobenius norm of
	 * @returns {Number} Frobenius norm
	 */
	mat4.frob = function (a) {
	    return(Math.sqrt(Math.pow(a[0], 2) + Math.pow(a[1], 2) + Math.pow(a[2], 2) + Math.pow(a[3], 2) + Math.pow(a[4], 2) + Math.pow(a[5], 2) + Math.pow(a[6], 2) + Math.pow(a[7], 2) + Math.pow(a[8], 2) + Math.pow(a[9], 2) + Math.pow(a[10], 2) + Math.pow(a[11], 2) + Math.pow(a[12], 2) + Math.pow(a[13], 2) + Math.pow(a[14], 2) + Math.pow(a[15], 2) ))
	};


	if(typeof(exports) !== 'undefined') {
	    exports.mat4 = mat4;
	}
	;
	/* Copyright (c) 2013, Brandon Jones, Colin MacKenzie IV. All rights reserved.

	Redistribution and use in source and binary forms, with or without modification,
	are permitted provided that the following conditions are met:

	  * Redistributions of source code must retain the above copyright notice, this
	    list of conditions and the following disclaimer.
	  * Redistributions in binary form must reproduce the above copyright notice,
	    this list of conditions and the following disclaimer in the documentation
	    and/or other materials provided with the distribution.

	THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
	ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
	WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
	DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
	ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
	(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
	LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
	ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
	(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
	SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */

	/**
	 * @class Quaternion
	 * @name quat
	 */

	var quat = {};

	/**
	 * Creates a new identity quat
	 *
	 * @returns {quat} a new quaternion
	 */
	quat.create = function() {
	    var out = new GLMAT_ARRAY_TYPE(4);
	    out[0] = 0;
	    out[1] = 0;
	    out[2] = 0;
	    out[3] = 1;
	    return out;
	};

	/**
	 * Sets a quaternion to represent the shortest rotation from one
	 * vector to another.
	 *
	 * Both vectors are assumed to be unit length.
	 *
	 * @param {quat} out the receiving quaternion.
	 * @param {vec3} a the initial vector
	 * @param {vec3} b the destination vector
	 * @returns {quat} out
	 */
	quat.rotationTo = (function() {
	    var tmpvec3 = vec3.create();
	    var xUnitVec3 = vec3.fromValues(1,0,0);
	    var yUnitVec3 = vec3.fromValues(0,1,0);

	    return function(out, a, b) {
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
	})();

	/**
	 * Sets the specified quaternion with values corresponding to the given
	 * axes. Each axis is a vec3 and is expected to be unit length and
	 * perpendicular to all other specified axes.
	 *
	 * @param {vec3} view  the vector representing the viewing direction
	 * @param {vec3} right the vector representing the local "right" direction
	 * @param {vec3} up    the vector representing the local "up" direction
	 * @returns {quat} out
	 */
	quat.setAxes = (function() {
	    var matr = mat3.create();

	    return function(out, view, right, up) {
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
	})();

	/**
	 * Creates a new quat initialized with values from an existing quaternion
	 *
	 * @param {quat} a quaternion to clone
	 * @returns {quat} a new quaternion
	 * @function
	 */
	quat.clone = vec4.clone;

	/**
	 * Creates a new quat initialized with the given values
	 *
	 * @param {Number} x X component
	 * @param {Number} y Y component
	 * @param {Number} z Z component
	 * @param {Number} w W component
	 * @returns {quat} a new quaternion
	 * @function
	 */
	quat.fromValues = vec4.fromValues;

	/**
	 * Copy the values from one quat to another
	 *
	 * @param {quat} out the receiving quaternion
	 * @param {quat} a the source quaternion
	 * @returns {quat} out
	 * @function
	 */
	quat.copy = vec4.copy;

	/**
	 * Set the components of a quat to the given values
	 *
	 * @param {quat} out the receiving quaternion
	 * @param {Number} x X component
	 * @param {Number} y Y component
	 * @param {Number} z Z component
	 * @param {Number} w W component
	 * @returns {quat} out
	 * @function
	 */
	quat.set = vec4.set;

	/**
	 * Set a quat to the identity quaternion
	 *
	 * @param {quat} out the receiving quaternion
	 * @returns {quat} out
	 */
	quat.identity = function(out) {
	    out[0] = 0;
	    out[1] = 0;
	    out[2] = 0;
	    out[3] = 1;
	    return out;
	};

	/**
	 * Sets a quat from the given angle and rotation axis,
	 * then returns it.
	 *
	 * @param {quat} out the receiving quaternion
	 * @param {vec3} axis the axis around which to rotate
	 * @param {Number} rad the angle in radians
	 * @returns {quat} out
	 **/
	quat.setAxisAngle = function(out, axis, rad) {
	    rad = rad * 0.5;
	    var s = Math.sin(rad);
	    out[0] = s * axis[0];
	    out[1] = s * axis[1];
	    out[2] = s * axis[2];
	    out[3] = Math.cos(rad);
	    return out;
	};

	/**
	 * Adds two quat's
	 *
	 * @param {quat} out the receiving quaternion
	 * @param {quat} a the first operand
	 * @param {quat} b the second operand
	 * @returns {quat} out
	 * @function
	 */
	quat.add = vec4.add;

	/**
	 * Multiplies two quat's
	 *
	 * @param {quat} out the receiving quaternion
	 * @param {quat} a the first operand
	 * @param {quat} b the second operand
	 * @returns {quat} out
	 */
	quat.multiply = function(out, a, b) {
	    var ax = a[0], ay = a[1], az = a[2], aw = a[3],
	        bx = b[0], by = b[1], bz = b[2], bw = b[3];

	    out[0] = ax * bw + aw * bx + ay * bz - az * by;
	    out[1] = ay * bw + aw * by + az * bx - ax * bz;
	    out[2] = az * bw + aw * bz + ax * by - ay * bx;
	    out[3] = aw * bw - ax * bx - ay * by - az * bz;
	    return out;
	};

	/**
	 * Alias for {@link quat.multiply}
	 * @function
	 */
	quat.mul = quat.multiply;

	/**
	 * Scales a quat by a scalar number
	 *
	 * @param {quat} out the receiving vector
	 * @param {quat} a the vector to scale
	 * @param {Number} b amount to scale the vector by
	 * @returns {quat} out
	 * @function
	 */
	quat.scale = vec4.scale;

	/**
	 * Rotates a quaternion by the given angle about the X axis
	 *
	 * @param {quat} out quat receiving operation result
	 * @param {quat} a quat to rotate
	 * @param {number} rad angle (in radians) to rotate
	 * @returns {quat} out
	 */
	quat.rotateX = function (out, a, rad) {
	    rad *= 0.5;

	    var ax = a[0], ay = a[1], az = a[2], aw = a[3],
	        bx = Math.sin(rad), bw = Math.cos(rad);

	    out[0] = ax * bw + aw * bx;
	    out[1] = ay * bw + az * bx;
	    out[2] = az * bw - ay * bx;
	    out[3] = aw * bw - ax * bx;
	    return out;
	};

	/**
	 * Rotates a quaternion by the given angle about the Y axis
	 *
	 * @param {quat} out quat receiving operation result
	 * @param {quat} a quat to rotate
	 * @param {number} rad angle (in radians) to rotate
	 * @returns {quat} out
	 */
	quat.rotateY = function (out, a, rad) {
	    rad *= 0.5;

	    var ax = a[0], ay = a[1], az = a[2], aw = a[3],
	        by = Math.sin(rad), bw = Math.cos(rad);

	    out[0] = ax * bw - az * by;
	    out[1] = ay * bw + aw * by;
	    out[2] = az * bw + ax * by;
	    out[3] = aw * bw - ay * by;
	    return out;
	};

	/**
	 * Rotates a quaternion by the given angle about the Z axis
	 *
	 * @param {quat} out quat receiving operation result
	 * @param {quat} a quat to rotate
	 * @param {number} rad angle (in radians) to rotate
	 * @returns {quat} out
	 */
	quat.rotateZ = function (out, a, rad) {
	    rad *= 0.5;

	    var ax = a[0], ay = a[1], az = a[2], aw = a[3],
	        bz = Math.sin(rad), bw = Math.cos(rad);

	    out[0] = ax * bw + ay * bz;
	    out[1] = ay * bw - ax * bz;
	    out[2] = az * bw + aw * bz;
	    out[3] = aw * bw - az * bz;
	    return out;
	};

	/**
	 * Calculates the W component of a quat from the X, Y, and Z components.
	 * Assumes that quaternion is 1 unit in length.
	 * Any existing W component will be ignored.
	 *
	 * @param {quat} out the receiving quaternion
	 * @param {quat} a quat to calculate W component of
	 * @returns {quat} out
	 */
	quat.calculateW = function (out, a) {
	    var x = a[0], y = a[1], z = a[2];

	    out[0] = x;
	    out[1] = y;
	    out[2] = z;
	    out[3] = Math.sqrt(Math.abs(1.0 - x * x - y * y - z * z));
	    return out;
	};

	/**
	 * Calculates the dot product of two quat's
	 *
	 * @param {quat} a the first operand
	 * @param {quat} b the second operand
	 * @returns {Number} dot product of a and b
	 * @function
	 */
	quat.dot = vec4.dot;

	/**
	 * Performs a linear interpolation between two quat's
	 *
	 * @param {quat} out the receiving quaternion
	 * @param {quat} a the first operand
	 * @param {quat} b the second operand
	 * @param {Number} t interpolation amount between the two inputs
	 * @returns {quat} out
	 * @function
	 */
	quat.lerp = vec4.lerp;

	/**
	 * Performs a spherical linear interpolation between two quat
	 *
	 * @param {quat} out the receiving quaternion
	 * @param {quat} a the first operand
	 * @param {quat} b the second operand
	 * @param {Number} t interpolation amount between the two inputs
	 * @returns {quat} out
	 */
	quat.slerp = function (out, a, b, t) {
	    // benchmarks:
	    //    http://jsperf.com/quaternion-slerp-implementations

	    var ax = a[0], ay = a[1], az = a[2], aw = a[3],
	        bx = b[0], by = b[1], bz = b[2], bw = b[3];

	    var        omega, cosom, sinom, scale0, scale1;

	    // calc cosine
	    cosom = ax * bx + ay * by + az * bz + aw * bw;
	    // adjust signs (if necessary)
	    if ( cosom < 0.0 ) {
	        cosom = -cosom;
	        bx = - bx;
	        by = - by;
	        bz = - bz;
	        bw = - bw;
	    }
	    // calculate coefficients
	    if ( (1.0 - cosom) > 0.000001 ) {
	        // standard case (slerp)
	        omega  = Math.acos(cosom);
	        sinom  = Math.sin(omega);
	        scale0 = Math.sin((1.0 - t) * omega) / sinom;
	        scale1 = Math.sin(t * omega) / sinom;
	    } else {
	        // "from" and "to" quaternions are very close
	        //  ... so we can do a linear interpolation
	        scale0 = 1.0 - t;
	        scale1 = t;
	    }
	    // calculate final values
	    out[0] = scale0 * ax + scale1 * bx;
	    out[1] = scale0 * ay + scale1 * by;
	    out[2] = scale0 * az + scale1 * bz;
	    out[3] = scale0 * aw + scale1 * bw;

	    return out;
	};

	/**
	 * Calculates the inverse of a quat
	 *
	 * @param {quat} out the receiving quaternion
	 * @param {quat} a quat to calculate inverse of
	 * @returns {quat} out
	 */
	quat.invert = function(out, a) {
	    var a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3],
	        dot = a0*a0 + a1*a1 + a2*a2 + a3*a3,
	        invDot = dot ? 1.0/dot : 0;

	    // TODO: Would be faster to return [0,0,0,0] immediately if dot == 0

	    out[0] = -a0*invDot;
	    out[1] = -a1*invDot;
	    out[2] = -a2*invDot;
	    out[3] = a3*invDot;
	    return out;
	};

	/**
	 * Calculates the conjugate of a quat
	 * If the quaternion is normalized, this function is faster than quat.inverse and produces the same result.
	 *
	 * @param {quat} out the receiving quaternion
	 * @param {quat} a quat to calculate conjugate of
	 * @returns {quat} out
	 */
	quat.conjugate = function (out, a) {
	    out[0] = -a[0];
	    out[1] = -a[1];
	    out[2] = -a[2];
	    out[3] = a[3];
	    return out;
	};

	/**
	 * Calculates the length of a quat
	 *
	 * @param {quat} a vector to calculate length of
	 * @returns {Number} length of a
	 * @function
	 */
	quat.length = vec4.length;

	/**
	 * Alias for {@link quat.length}
	 * @function
	 */
	quat.len = quat.length;

	/**
	 * Calculates the squared length of a quat
	 *
	 * @param {quat} a vector to calculate squared length of
	 * @returns {Number} squared length of a
	 * @function
	 */
	quat.squaredLength = vec4.squaredLength;

	/**
	 * Alias for {@link quat.squaredLength}
	 * @function
	 */
	quat.sqrLen = quat.squaredLength;

	/**
	 * Normalize a quat
	 *
	 * @param {quat} out the receiving quaternion
	 * @param {quat} a quaternion to normalize
	 * @returns {quat} out
	 * @function
	 */
	quat.normalize = vec4.normalize;

	/**
	 * Creates a quaternion from the given 3x3 rotation matrix.
	 *
	 * NOTE: The resultant quaternion is not normalized, so you should be sure
	 * to renormalize the quaternion yourself where necessary.
	 *
	 * @param {quat} out the receiving quaternion
	 * @param {mat3} m rotation matrix
	 * @returns {quat} out
	 * @function
	 */
	quat.fromMat3 = function(out, m) {
	    // Algorithm in Ken Shoemake's article in 1987 SIGGRAPH course notes
	    // article "Quaternion Calculus and Fast Animation".
	    var fTrace = m[0] + m[4] + m[8];
	    var fRoot;

	    if ( fTrace > 0.0 ) {
	        // |w| > 1/2, may as well choose w > 1/2
	        fRoot = Math.sqrt(fTrace + 1.0);  // 2w
	        out[3] = 0.5 * fRoot;
	        fRoot = 0.5/fRoot;  // 1/(4w)
	        out[0] = (m[5]-m[7])*fRoot;
	        out[1] = (m[6]-m[2])*fRoot;
	        out[2] = (m[1]-m[3])*fRoot;
	    } else {
	        // |w| <= 1/2
	        var i = 0;
	        if ( m[4] > m[0] )
	          i = 1;
	        if ( m[8] > m[i*3+i] )
	          i = 2;
	        var j = (i+1)%3;
	        var k = (i+2)%3;

	        fRoot = Math.sqrt(m[i*3+i]-m[j*3+j]-m[k*3+k] + 1.0);
	        out[i] = 0.5 * fRoot;
	        fRoot = 0.5 / fRoot;
	        out[3] = (m[j*3+k] - m[k*3+j]) * fRoot;
	        out[j] = (m[j*3+i] + m[i*3+j]) * fRoot;
	        out[k] = (m[k*3+i] + m[i*3+k]) * fRoot;
	    }

	    return out;
	};

	/**
	 * Returns a string representation of a quatenion
	 *
	 * @param {quat} vec vector to represent as a string
	 * @returns {String} string representation of the vector
	 */
	quat.str = function (a) {
	    return 'quat(' + a[0] + ', ' + a[1] + ', ' + a[2] + ', ' + a[3] + ')';
	};

	if(typeof(exports) !== 'undefined') {
	    exports.quat = quat;
	}
	;













	  })(shim.exports);
	})(this);

/***/ },
/* 16 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';


	    var glMatrix = __webpack_require__(15);
	    var Vector3 = __webpack_require__(14);
	    var mat4 = glMatrix.mat4;
	    var vec3 = glMatrix.vec3;
	    var mat3 = glMatrix.mat3;
	    var quat = glMatrix.quat;

	    /**
	     * @constructor
	     * @alias qtek.math.Matrix4
	     */
	    var Matrix4 = function() {

	        this._axisX = new Vector3();
	        this._axisY = new Vector3();
	        this._axisZ = new Vector3();

	        /**
	         * Storage of Matrix4
	         * @name _array
	         * @type {Float32Array}
	         */
	        this._array = mat4.create();

	        /**
	         * @name _dirty
	         * @type {boolean}
	         */
	        this._dirty = true;
	    };

	    Matrix4.prototype = {

	        constructor: Matrix4,

	        /**
	         * Set components from array
	         * @param  {Float32Array|number[]} arr
	         */
	        setArray: function (arr) {
	            for (var i = 0; i < this._array.length; i++) {
	                this._array[i] = arr[i];
	            }
	            this._dirty = true;
	            return this;
	        },
	        /**
	         * Calculate the adjugate of self, in-place
	         * @return {qtek.math.Matrix4}
	         */
	        adjoint: function() {
	            mat4.adjoint(this._array, this._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Clone a new Matrix4
	         * @return {qtek.math.Matrix4}
	         */
	        clone: function() {
	            return (new Matrix4()).copy(this);
	        },

	        /**
	         * Copy from b
	         * @param  {qtek.math.Matrix4} b
	         * @return {qtek.math.Matrix4}
	         */
	        copy: function(a) {
	            mat4.copy(this._array, a._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Calculate matrix determinant
	         * @return {number}
	         */
	        determinant: function() {
	            return mat4.determinant(this._array);
	        },

	        /**
	         * Set upper 3x3 part from quaternion
	         * @param  {qtek.math.Quaternion} q
	         * @return {qtek.math.Matrix4}
	         */
	        fromQuat: function(q) {
	            mat4.fromQuat(this._array, q._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Set from a quaternion rotation and a vector translation
	         * @param  {qtek.math.Quaternion} q
	         * @param  {qtek.math.Vector3} v
	         * @return {qtek.math.Matrix4}
	         */
	        fromRotationTranslation: function(q, v) {
	            mat4.fromRotationTranslation(this._array, q._array, v._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Set from Matrix2d, it is used when converting a 2d shape to 3d space.
	         * In 3d space it is equivalent to ranslate on xy plane and rotate about z axis
	         * @param  {qtek.math.Matrix2d} m2d
	         * @return {qtek.math.Matrix4}
	         */
	        fromMat2d: function(m2d) {
	            Matrix4.fromMat2d(this, m2d);
	            return this;
	        },

	        /**
	         * Set from frustum bounds
	         * @param  {number} left
	         * @param  {number} right
	         * @param  {number} bottom
	         * @param  {number} top
	         * @param  {number} near
	         * @param  {number} far
	         * @return {qtek.math.Matrix4}
	         */
	        frustum: function (left, right, bottom, top, near, far) {
	            mat4.frustum(this._array, left, right, bottom, top, near, far);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Set to a identity matrix
	         * @return {qtek.math.Matrix4}
	         */
	        identity: function() {
	            mat4.identity(this._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Invert self
	         * @return {qtek.math.Matrix4}
	         */
	        invert: function() {
	            mat4.invert(this._array, this._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Set as a matrix with the given eye position, focal point, and up axis
	         * @param  {qtek.math.Vector3} eye
	         * @param  {qtek.math.Vector3} center
	         * @param  {qtek.math.Vector3} up
	         * @return {qtek.math.Matrix4}
	         */
	        lookAt: function(eye, center, up) {
	            mat4.lookAt(this._array, eye._array, center._array, up._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Alias for mutiply
	         * @param  {qtek.math.Matrix4} b
	         * @return {qtek.math.Matrix4}
	         */
	        mul: function(b) {
	            mat4.mul(this._array, this._array, b._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Alias for multiplyLeft
	         * @param  {qtek.math.Matrix4} a
	         * @return {qtek.math.Matrix4}
	         */
	        mulLeft: function(a) {
	            mat4.mul(this._array, a._array, this._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Multiply self and b
	         * @param  {qtek.math.Matrix4} b
	         * @return {qtek.math.Matrix4}
	         */
	        multiply: function(b) {
	            mat4.multiply(this._array, this._array, b._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Multiply a and self, a is on the left
	         * @param  {qtek.math.Matrix3} a
	         * @return {qtek.math.Matrix3}
	         */
	        multiplyLeft: function(a) {
	            mat4.multiply(this._array, a._array, this._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Set as a orthographic projection matrix
	         * @param  {number} left
	         * @param  {number} right
	         * @param  {number} bottom
	         * @param  {number} top
	         * @param  {number} near
	         * @param  {number} far
	         * @return {qtek.math.Matrix4}
	         */
	        ortho: function(left, right, bottom, top, near, far) {
	            mat4.ortho(this._array, left, right, bottom, top, near, far);
	            this._dirty = true;
	            return this;
	        },
	        /**
	         * Set as a perspective projection matrix
	         * @param  {number} fovy
	         * @param  {number} aspect
	         * @param  {number} near
	         * @param  {number} far
	         * @return {qtek.math.Matrix4}
	         */
	        perspective: function(fovy, aspect, near, far) {
	            mat4.perspective(this._array, fovy, aspect, near, far);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Rotate self by rad about axis.
	         * Equal to right-multiply a rotaion matrix
	         * @param  {number}   rad
	         * @param  {qtek.math.Vector3} axis
	         * @return {qtek.math.Matrix4}
	         */
	        rotate: function(rad, axis) {
	            mat4.rotate(this._array, this._array, rad, axis._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Rotate self by a given radian about X axis.
	         * Equal to right-multiply a rotaion matrix
	         * @param {number} rad
	         * @return {qtek.math.Matrix4}
	         */
	        rotateX: function(rad) {
	            mat4.rotateX(this._array, this._array, rad);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Rotate self by a given radian about Y axis.
	         * Equal to right-multiply a rotaion matrix
	         * @param {number} rad
	         * @return {qtek.math.Matrix4}
	         */
	        rotateY: function(rad) {
	            mat4.rotateY(this._array, this._array, rad);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Rotate self by a given radian about Z axis.
	         * Equal to right-multiply a rotaion matrix
	         * @param {number} rad
	         * @return {qtek.math.Matrix4}
	         */
	        rotateZ: function(rad) {
	            mat4.rotateZ(this._array, this._array, rad);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Scale self by s
	         * Equal to right-multiply a scale matrix
	         * @param  {qtek.math.Vector3}  s
	         * @return {qtek.math.Matrix4}
	         */
	        scale: function(v) {
	            mat4.scale(this._array, this._array, v._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Translate self by v.
	         * Equal to right-multiply a translate matrix
	         * @param  {qtek.math.Vector3}  v
	         * @return {qtek.math.Matrix4}
	         */
	        translate: function(v) {
	            mat4.translate(this._array, this._array, v._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Transpose self, in-place.
	         * @return {qtek.math.Matrix2}
	         */
	        transpose: function() {
	            mat4.transpose(this._array, this._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Decompose a matrix to SRT
	         * @param {qtek.math.Vector3} [scale]
	         * @param {qtek.math.Quaternion} rotation
	         * @param {qtek.math.Vector} position
	         * @see http://msdn.microsoft.com/en-us/library/microsoft.xna.framework.matrix.decompose.aspx
	         */
	        decomposeMatrix: (function() {

	            var x = vec3.create();
	            var y = vec3.create();
	            var z = vec3.create();

	            var m3 = mat3.create();

	            return function(scale, rotation, position) {

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
	                // Not like mat4, mat3 in glmatrix seems to be row-based
	                // Seems fixed in gl-matrix 2.2.2
	                // https://github.com/toji/gl-matrix/issues/114
	                // mat3.transpose(m3, m3);

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
	        })(),

	        toString: function() {
	            return '[' + Array.prototype.join.call(this._array, ',') + ']';
	        },

	        toArray: function () {
	            return Array.prototype.slice.call(this._array);
	        }
	    };

	    var defineProperty = Object.defineProperty;

	    if (defineProperty) {
	        var proto = Matrix4.prototype;
	        /**
	         * Z Axis of local transform
	         * @name z
	         * @type {qtek.math.Vector3}
	         * @memberOf qtek.math.Matrix4
	         * @instance
	         */
	        defineProperty(proto, 'z', {
	            get: function () {
	                var el = this._array;
	                this._axisZ.set(el[8], el[9], el[10]);
	                return this._axisZ;
	            },
	            set: function (v) {
	                // TODO Here has a problem
	                // If only set an item of vector will not work
	                var el = this._array;
	                v = v._array;
	                el[8] = v[0];
	                el[9] = v[1];
	                el[10] = v[2];

	                this._dirty = true;
	            }
	        });

	        /**
	         * Y Axis of local transform
	         * @name y
	         * @type {qtek.math.Vector3}
	         * @memberOf qtek.math.Matrix4
	         * @instance
	         */
	        defineProperty(proto, 'y', {
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

	        /**
	         * X Axis of local transform
	         * @name x
	         * @type {qtek.math.Vector3}
	         * @memberOf qtek.math.Matrix4
	         * @instance
	         */
	        defineProperty(proto, 'x', {
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
	        })
	    }

	    /**
	     * @param  {qtek.math.Matrix4} out
	     * @param  {qtek.math.Matrix4} a
	     * @return {qtek.math.Matrix4}
	     */
	    Matrix4.adjoint = function(out, a) {
	        mat4.adjoint(out._array, a._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Matrix4} out
	     * @param  {qtek.math.Matrix4} a
	     * @return {qtek.math.Matrix4}
	     */
	    Matrix4.copy = function(out, a) {
	        mat4.copy(out._array, a._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Matrix4} a
	     * @return {number}
	     */
	    Matrix4.determinant = function(a) {
	        return mat4.determinant(a._array);
	    };

	    /**
	     * @param  {qtek.math.Matrix4} out
	     * @return {qtek.math.Matrix4}
	     */
	    Matrix4.identity = function(out) {
	        mat4.identity(out._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Matrix4} out
	     * @param  {number}  left
	     * @param  {number}  right
	     * @param  {number}  bottom
	     * @param  {number}  top
	     * @param  {number}  near
	     * @param  {number}  far
	     * @return {qtek.math.Matrix4}
	     */
	    Matrix4.ortho = function(out, left, right, bottom, top, near, far) {
	        mat4.ortho(out._array, left, right, bottom, top, near, far);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Matrix4} out
	     * @param  {number}  fovy
	     * @param  {number}  aspect
	     * @param  {number}  near
	     * @param  {number}  far
	     * @return {qtek.math.Matrix4}
	     */
	    Matrix4.perspective = function(out, fovy, aspect, near, far) {
	        mat4.perspective(out._array, fovy, aspect, near, far);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Matrix4} out
	     * @param  {qtek.math.Vector3} eye
	     * @param  {qtek.math.Vector3} center
	     * @param  {qtek.math.Vector3} up
	     * @return {qtek.math.Matrix4}
	     */
	    Matrix4.lookAt = function(out, eye, center, up) {
	        mat4.lookAt(out._array, eye._array, center._array, up._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Matrix4} out
	     * @param  {qtek.math.Matrix4} a
	     * @return {qtek.math.Matrix4}
	     */
	    Matrix4.invert = function(out, a) {
	        mat4.invert(out._array, a._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Matrix4} out
	     * @param  {qtek.math.Matrix4} a
	     * @param  {qtek.math.Matrix4} b
	     * @return {qtek.math.Matrix4}
	     */
	    Matrix4.mul = function(out, a, b) {
	        mat4.mul(out._array, a._array, b._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @method
	     * @param  {qtek.math.Matrix4} out
	     * @param  {qtek.math.Matrix4} a
	     * @param  {qtek.math.Matrix4} b
	     * @return {qtek.math.Matrix4}
	     */
	    Matrix4.multiply = Matrix4.mul;

	    /**
	     * @param  {qtek.math.Matrix4}    out
	     * @param  {qtek.math.Quaternion} q
	     * @return {qtek.math.Matrix4}
	     */
	    Matrix4.fromQuat = function(out, q) {
	        mat4.fromQuat(out._array, q._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Matrix4}    out
	     * @param  {qtek.math.Quaternion} q
	     * @param  {qtek.math.Vector3}    v
	     * @return {qtek.math.Matrix4}
	     */
	    Matrix4.fromRotationTranslation = function(out, q, v) {
	        mat4.fromRotationTranslation(out._array, q._array, v._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Matrix4} m4
	     * @param  {qtek.math.Matrix2d} m2d
	     * @return {qtek.math.Matrix4}
	     */
	    Matrix4.fromMat2d = function(m4, m2d) {
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

	    /**
	     * @param  {qtek.math.Matrix4} out
	     * @param  {qtek.math.Matrix4} a
	     * @param  {number}  rad
	     * @param  {qtek.math.Vector3} axis
	     * @return {qtek.math.Matrix4}
	     */
	    Matrix4.rotate = function(out, a, rad, axis) {
	        mat4.rotate(out._array, a._array, rad, axis._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Matrix4} out
	     * @param  {qtek.math.Matrix4} a
	     * @param  {number}  rad
	     * @return {qtek.math.Matrix4}
	     */
	    Matrix4.rotateX = function(out, a, rad) {
	        mat4.rotateX(out._array, a._array, rad);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Matrix4} out
	     * @param  {qtek.math.Matrix4} a
	     * @param  {number}  rad
	     * @return {qtek.math.Matrix4}
	     */
	    Matrix4.rotateY = function(out, a, rad) {
	        mat4.rotateY(out._array, a._array, rad);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Matrix4} out
	     * @param  {qtek.math.Matrix4} a
	     * @param  {number}  rad
	     * @return {qtek.math.Matrix4}
	     */
	    Matrix4.rotateZ = function(out, a, rad) {
	        mat4.rotateZ(out._array, a._array, rad);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Matrix4} out
	     * @param  {qtek.math.Matrix4} a
	     * @param  {qtek.math.Vector3} v
	     * @return {qtek.math.Matrix4}
	     */
	    Matrix4.scale = function(out, a, v) {
	        mat4.scale(out._array, a._array, v._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Matrix4} out
	     * @param  {qtek.math.Matrix4} a
	     * @return {qtek.math.Matrix4}
	     */
	    Matrix4.transpose = function(out, a) {
	        mat4.transpose(out._array, a._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Matrix4} out
	     * @param  {qtek.math.Matrix4} a
	     * @param  {qtek.math.Vector3} v
	     * @return {qtek.math.Matrix4}
	     */
	    Matrix4.translate = function(out, a, v) {
	        mat4.translate(out._array, a._array, v._array);
	        out._dirty = true;
	        return out;
	    };

	    module.exports = Matrix4;


/***/ },
/* 17 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * @export{Object} library
	 */


	    var Shader = __webpack_require__(18);
	    var util = __webpack_require__(9);

	    var _library = {};

	    /**
	     * @export qtek.shader.library~Libaray
	     */
	    function ShaderLibrary () {
	        this._pool = {};
	    }

	    /**
	     * ### Builin shaders
	     * + qtek.standard
	     * + qtek.basic
	     * + qtek.lambert
	     * + qtek.phong
	     * + qtek.wireframe
	     *
	     * @namespace qtek.shader.library
	     */
	    /**
	     *
	     * Get shader from library. use shader name and option as hash key.
	     *
	     * @param {string} name
	     * @param {Object|string|Array.<string>} [option]
	     * @return {qtek.Shader}
	     *
	     * @example
	     *     qtek.shader.library.get('qtek.phong', 'diffuseMap', 'normalMap');
	     *     qtek.shader.library.get('qtek.phong', ['diffuseMap', 'normalMap']);
	     *     qtek.shader.library.get('qtek.phong', {
	     *         textures: ['diffuseMap'],
	     *         vertexDefines: {},
	     *         fragmentDefines: {}
	     *     })
	     */
	    ShaderLibrary.prototype.get = function(name, option) {
	        var enabledTextures = [];
	        var vertexDefines = {};
	        var fragmentDefines = {};
	        if (typeof(option) === 'string') {
	            enabledTextures = Array.prototype.slice.call(arguments, 1);
	        }
	        else if (Object.prototype.toString.call(option) == '[object Object]') {
	            enabledTextures = option.textures || [];
	            vertexDefines = option.vertexDefines || {};
	            fragmentDefines = option.fragmentDefines || {};
	        }
	        else if (option instanceof Array) {
	            enabledTextures = option;
	        }
	        var vertexDefineKeys = Object.keys(vertexDefines);
	        var fragmentDefineKeys = Object.keys(fragmentDefines);
	        enabledTextures.sort();
	        vertexDefineKeys.sort();
	        fragmentDefineKeys.sort();

	        var keyArr = [name];
	        keyArr = keyArr.concat(enabledTextures);
	        for (var i = 0; i < vertexDefineKeys.length; i++) {
	            keyArr.push(
	                vertexDefineKeys[i],
	                vertexDefines[vertexDefineKeys[i]]
	            );
	        }
	        for (var i = 0; i < fragmentDefineKeys.length; i++) {
	            keyArr.push(
	                fragmentDefineKeys[i],
	                fragmentDefines[fragmentDefineKeys[i]]
	            );
	        }
	        var key = keyArr.join('_');

	        if (this._pool[key]) {
	            return this._pool[key];
	        }
	        else {
	            var source = _library[name];
	            if (!source) {
	                console.error('Shader "' + name + '"' + ' is not in the library');
	                return;
	            }
	            var shader = new Shader({
	                'vertex': source.vertex,
	                'fragment': source.fragment
	            });
	            for (var i = 0; i < enabledTextures.length; i++) {
	                shader.enableTexture(enabledTextures[i]);
	            }
	            for (var name in vertexDefines) {
	                shader.define('vertex', name, vertexDefines[name]);
	            }
	            for (var name in fragmentDefines) {
	                shader.define('fragment', name, fragmentDefines[name]);
	            }
	            this._pool[key] = shader;
	            return shader;
	        }
	    };

	    /**
	     * Clear shaders
	     */
	    ShaderLibrary.prototype.clear = function() {
	        this._pool = {};
	    };

	    /**
	     * @memberOf qtek.shader.library
	     * @param  {string} name
	     * @param  {string} vertex - Vertex shader code
	     * @param  {string} fragment - Fragment shader code
	     */
	    function template(name, vertex, fragment) {
	        _library[name] = {
	            vertex: vertex,
	            fragment: fragment
	        };
	    }

	    var defaultLibrary = new ShaderLibrary();

	    module.exports = {
	        createLibrary: function () {
	            return new ShaderLibrary();
	        },
	        get: function () {
	            return defaultLibrary.get.apply(defaultLibrary, arguments);
	        },
	        template: template,
	        clear: function () {
	            return defaultLibrary.clear();
	        }
	    };


/***/ },
/* 18 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	/**
	 * Mainly do the parse and compile of shader string
	 * Support shader code chunk import and export
	 * Support shader semantics
	 * http://www.nvidia.com/object/using_sas.html
	 * https://github.com/KhronosGroup/collada2json/issues/45
	 *
	 * TODO: Use etpl or other string template engine
	 */


	    var Base = __webpack_require__(6);
	    var util = __webpack_require__(9);
	    var Cache = __webpack_require__(19);
	    var vendor = __webpack_require__(12);
	    var glMatrix = __webpack_require__(15);
	    var glInfo = __webpack_require__(10);
	    var mat2 = glMatrix.mat2;
	    var mat3 = glMatrix.mat3;
	    var mat4 = glMatrix.mat4;

	    var uniformRegex = /uniform\s+(bool|float|int|vec2|vec3|vec4|ivec2|ivec3|ivec4|mat2|mat3|mat4|sampler2D|samplerCube)\s+([\w\,]+)?(\[.*?\])?\s*(:\s*([\S\s]+?))?;/g;
	    var attributeRegex = /attribute\s+(float|int|vec2|vec3|vec4)\s+(\w*)\s*(:\s*(\w+))?;/g;
	    var defineRegex = /#define\s+(\w+)?(\s+[\w-.]+)?\s*;?\s*\n/g;
	    var loopRegex = /for\s*?\(int\s*?_idx_\s*\=\s*([\w-]+)\;\s*_idx_\s*<\s*([\w-]+);\s*_idx_\s*\+\+\s*\)\s*\{\{([\s\S]+?)(?=\}\})\}\}/g;

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
	        'bool': function () {return true;},
	        'int': function () {return 0;},
	        'float': function () {return 0;},
	        'sampler2D': function () {return null;},
	        'samplerCube': function () {return null;},

	        'vec2': function () {return [0, 0];},
	        'vec3': function () {return [0, 0, 0];},
	        'vec4': function () {return [0, 0, 0, 0];},

	        'ivec2': function () {return [0, 0];},
	        'ivec3': function () {return [0, 0, 0];},
	        'ivec4': function () {return [0, 0, 0, 0];},

	        'mat2': function () {return mat2.create();},
	        'mat3': function () {return mat3.create();},
	        'mat4': function () {return mat4.create();},

	        'array': function () {return [];}
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
	        // Skinning
	        // https://github.com/KhronosGroup/glTF/blob/master/specification/README.md#semantics
	        'JOINT',
	        'WEIGHT'
	    ];
	    var uniformSemantics = [
	        'SKIN_MATRIX',
	        // Information about viewport
	        'VIEWPORT_SIZE',
	        'VIEWPORT',

	        // Window size for window relative coordinate
	        // https://www.opengl.org/sdk/docs/man/html/gl_FragCoord.xhtml
	        'WINDOW_SIZE'
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

	    // Enable attribute operation is global to all programs
	    // Here saved the list of all enabled attribute index
	    // http://www.mjbshaw.com/2013/03/webgl-fixing-invalidoperation.html
	    var enabledAttributeList = {};

	    var SHADER_STATE_TO_ENABLE = 1;
	    var SHADER_STATE_KEEP_ENABLE = 2;
	    var SHADER_STATE_PENDING = 3;

	    /**
	     * @constructor qtek.Shader
	     * @extends qtek.core.Base
	     *
	     * @example
	     *     // Create a phong shader
	     *     var shader = new qtek.Shader({
	     *         vertex: qtek.Shader.source('qtek.phong.vertex'),
	     *         fragment: qtek.Shader.source('qtek.phong.fragment')
	     *     });
	     *     // Enable diffuse texture
	     *     shader.enableTexture('diffuseMap');
	     *     // Use alpha channel in diffuse texture
	     *     shader.define('fragment', 'DIFFUSEMAP_ALPHA_ALPHA');
	     */
	    var Shader = Base.extend(function () {
	        return /** @lends qtek.Shader# */ {
	            /**
	             * Vertex shader code
	             * @type {string}
	             */
	            vertex: '',

	            /**
	             * Fragment shader code
	             * @type {string}
	             */
	            fragment: '',


	            // FIXME mediump is toooooo low for depth on mobile
	            precision: 'highp',

	            // Properties follow will be generated by the program
	            attribSemantics: {},
	            matrixSemantics: {},
	            uniformSemantics: {},
	            matrixSemanticKeys: [],

	            uniformTemplates: {},
	            attributeTemplates: {},

	            /**
	             * Custom defined values in the vertex shader
	             * @type {Object}
	             */
	            vertexDefines: {},
	            /**
	             * Custom defined values in the vertex shader
	             * @type {Object}
	             */
	            fragmentDefines: {},

	            /**
	             * Enabled extensions
	             * @type {Array.<string>}
	             */
	            extensions: [
	                'OES_standard_derivatives',
	                'EXT_shader_texture_lod'
	            ],

	            /**
	             * Used light group. default is all zero
	             */
	            lightGroup: 0,

	            // Defines the each type light number in the scene
	            // AMBIENT_LIGHT
	            // AMBIENT_SH_LIGHT
	            // AMBIENT_CUBEMAP_LIGHT
	            // POINT_LIGHT
	            // SPOT_LIGHT
	            // AREA_LIGHT
	            lightNumber: {},

	            _textureSlot: 0,

	            _attacheMaterialNumber: 0,

	            _uniformList: [],
	            // {
	            //  enabled: true
	            //  shaderType: "vertex",
	            // }
	            _textureStatus: {},

	            _vertexProcessed: '',
	            _fragmentProcessed: '',

	            _currentLocationsMap: {}
	        };
	    }, function () {

	        this._cache = new Cache();

	        this._updateShaderString();
	    },
	    /** @lends qtek.Shader.prototype */
	    {
	        /**
	         * Set vertex shader code
	         * @param {string} str
	         */
	        setVertex: function (str) {
	            this.vertex = str;
	            this._updateShaderString();
	            this.dirty();
	        },

	        /**
	         * Set fragment shader code
	         * @param {string} str
	         */
	        setFragment: function (str) {
	            this.fragment = str;
	            this._updateShaderString();
	            this.dirty();
	        },

	        /**
	         * Bind shader program
	         * Return true or error msg if error happened
	         * @param {WebGLRenderingContext} _gl
	         */
	        bind: function (_gl) {
	            var cache = this._cache;
	            cache.use(_gl.__GLID__, getCacheSchema);

	            this._currentLocationsMap = cache.get('locations');

	            // Reset slot
	            this._textureSlot = 0;

	            if (cache.isDirty()) {
	                var availableExts = [];
	                var extensions = this.extensions;
	                for (var i = 0; i < extensions.length; i++) {
	                    if (glInfo.getExtension(_gl, extensions[i])) {
	                        availableExts.push(extensions[i]);
	                    }
	                }

	                this._updateShaderString(availableExts);

	                var errMsg = this._buildProgram(_gl, this._vertexProcessed, this._fragmentProcessed);
	                cache.fresh();

	                if (errMsg) {
	                    return errMsg;
	                }
	            }

	            _gl.useProgram(cache.get('program'));
	        },

	        /**
	         * Mark dirty and update program in next frame
	         */
	        dirty: function () {
	            var cache = this._cache;
	            cache.dirtyAll();
	            for (var i = 0; i < cache._caches.length; i++) {
	                if (cache._caches[i]) {
	                    var context = cache._caches[i];
	                    context['locations'] = {};
	                    context['attriblocations'] = {};
	                }
	            }
	        },

	        _updateShaderString: function (extensions) {

	            if (this.vertex !== this._vertexPrev ||
	                this.fragment !== this._fragmentPrev
	            ) {

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

	            this._addDefineExtensionAndPrecision(extensions);

	            this._vertexProcessed = this._unrollLoop(this._vertexProcessed, this.vertexDefines);
	            this._fragmentProcessed = this._unrollLoop(this._fragmentProcessed, this.fragmentDefines);
	        },

	        /**
	         * Add a #define micro in shader code
	         * @param  {string} shaderType Can be vertex, fragment or both
	         * @param  {string} symbol
	         * @param  {number} [val]
	         */
	        define: function (shaderType, symbol, val) {
	            var vertexDefines = this.vertexDefines;
	            var fragmentDefines = this.fragmentDefines;
	            val = val != null ? val : null;
	            if (shaderType !== 'vertex' && shaderType !== 'fragment' && shaderType !== 'both'
	                && arguments.legnth < 3
	            ) {
	                // shaderType default to be 'both'
	                val = symbol;
	                symbol = shaderType;
	                shaderType = 'both';
	            }
	            if (shaderType === 'vertex' || shaderType === 'both') {
	                if (vertexDefines[symbol] !== val) {
	                    vertexDefines[symbol] = val;
	                    // Mark as dirty
	                    this.dirty();
	                }
	            }
	            if (shaderType === 'fragment' || shaderType === 'both') {
	                if (fragmentDefines[symbol] !== val) {
	                    fragmentDefines[symbol] = val;
	                    if (shaderType !== 'both') {
	                        this.dirty();
	                    }
	                }
	            }
	        },

	        /**
	         * @param  {string} shaderType Can be vertex, fragment or both
	         * @param  {string} symbol
	         */
	        unDefine: function (shaderType, symbol) {
	            if (shaderType !== 'vertex' && shaderType !== 'fragment' && shaderType !== 'both'
	                && arguments.legnth < 2
	            ) {
	                // shaderType default to be 'both'
	                symbol = shaderType;
	                shaderType = 'both';
	            }
	            if (shaderType === 'vertex' || shaderType === 'both') {
	                if (this.isDefined('vertex', symbol)) {
	                    delete this.vertexDefines[symbol];
	                    // Mark as dirty
	                    this.dirty();
	                }
	            }
	            if (shaderType === 'fragment' || shaderType === 'both') {
	                if (this.isDefined('fragment', symbol)) {
	                    delete this.fragmentDefines[symbol];
	                    if (shaderType !== 'both') {
	                        this.dirty();
	                    }
	                }
	            }
	        },

	        /**
	         * @param  {string} shaderType Can be vertex, fragment or both
	         * @param  {string} symbol
	         */
	        isDefined: function (shaderType, symbol) {
	            switch(shaderType) {
	                case 'vertex':
	                    return this.vertexDefines[symbol] !== undefined;
	                case 'fragment':
	                    return this.fragmentDefines[symbol] !== undefined;
	            }
	        },
	        /**
	         * @param  {string} shaderType Can be vertex, fragment or both
	         * @param  {string} symbol
	         */
	        getDefine: function (shaderType, symbol) {
	            switch(shaderType) {
	                case 'vertex':
	                    return this.vertexDefines[symbol];
	                case 'fragment':
	                    return this.fragmentDefines[symbol];
	            }
	        },
	        /**
	         * Enable a texture, actually it will add a #define micro in the shader code
	         * For example, if texture symbol is diffuseMap, it will add a line `#define DIFFUSEMAP_ENABLED` in the shader code
	         * @param  {string} symbol
	         */
	        enableTexture: function (symbol) {
	            if (symbol instanceof Array) {
	                for (var i = 0; i < symbol.length; i++) {
	                    this.enableTexture(symbol[i]);
	                }
	                return;
	            }

	            var status = this._textureStatus[symbol];
	            if (status) {
	                var isEnabled = status.enabled;
	                if (!isEnabled) {
	                    status.enabled = true;
	                    this.dirty();
	                }
	            }
	        },
	        /**
	         * Enable all textures used in the shader
	         */
	        enableTexturesAll: function () {
	            var textureStatus = this._textureStatus;
	            for (var symbol in textureStatus) {
	                textureStatus[symbol].enabled = true;
	            }

	            this.dirty();
	        },
	        /**
	         * Disable a texture, it remove a #define micro in the shader
	         * @param  {string} symbol
	         */
	        disableTexture: function (symbol) {
	            if (symbol instanceof Array) {
	                for (var i = 0; i < symbol.length; i++) {
	                    this.disableTexture(symbol[i]);
	                }
	                return;
	            }

	            var status = this._textureStatus[symbol];
	            if (status) {
	                var isDisabled = ! status.enabled;
	                if (!isDisabled) {
	                    status.enabled = false;
	                    this.dirty();
	                }
	            }
	        },
	        /**
	         * Disable all textures used in the shader
	         */
	        disableTexturesAll: function () {
	            var textureStatus = this._textureStatus;
	            for (var symbol in textureStatus) {
	                textureStatus[symbol].enabled = false;
	            }

	            this.dirty();
	        },
	        /**
	         * @param  {string}  symbol
	         * @return {boolean}
	         */
	        isTextureEnabled: function (symbol) {
	            var textureStatus = this._textureStatus;
	            return textureStatus[symbol]
	                && textureStatus[symbol].enabled;
	        },

	        getEnabledTextures: function () {
	            var enabledTextures = [];
	            var textureStatus = this._textureStatus;
	            for (var symbol in textureStatus) {
	                if (textureStatus[symbol].enabled) {
	                    enabledTextures.push(symbol);
	                }
	            }
	            return enabledTextures;
	        },

	        hasUniform: function (symbol) {
	            var location = this._currentLocationsMap[symbol];
	            return location !== null && location !== undefined;
	        },

	        currentTextureSlot: function () {
	            return this._textureSlot;
	        },

	        resetTextureSlot: function (slot) {
	            this._textureSlot = slot || 0;
	        },

	        useCurrentTextureSlot: function (_gl, texture) {
	            var textureSlot = this._textureSlot;

	            this.useTextureSlot(_gl, texture, textureSlot);

	            this._textureSlot++;

	            return textureSlot;
	        },

	        useTextureSlot: function (_gl, texture, slot) {
	            if (texture) {
	                _gl.activeTexture(_gl.TEXTURE0 + slot);
	                // Maybe texture is not loaded yet;
	                if (texture.isRenderable()) {
	                    texture.bind(_gl);
	                }
	                else {
	                    // Bind texture to null
	                    texture.unbind(_gl);
	                }
	            }
	        },

	        setUniform: function (_gl, type, symbol, value) {
	            var locationMap = this._currentLocationsMap;
	            var location = locationMap[symbol];
	            // Uniform is not existed in the shader
	            if (location === null || location === undefined) {
	                return false;
	            }
	            switch (type) {
	                case 'm4':
	                    // The matrix must be created by glmatrix and can pass it directly.
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
	                    // Raw value
	                    if (value instanceof Array) {
	                        var array = new vendor.Float32Array(value.length * 16);
	                        var cursor = 0;
	                        for (var i = 0; i < value.length; i++) {
	                            var item = value[i];
	                            for (var j = 0; j < 16; j++) {
	                                array[cursor++] = item[j];
	                            }
	                        }
	                        _gl.uniformMatrix4fv(location, false, array);
	                    }
	                    else if (value instanceof vendor.Float32Array) {   // ArrayBufferView
	                        _gl.uniformMatrix4fv(location, false, value);
	                    }
	                    break;
	            }
	            return true;
	        },

	        setUniformOfSemantic: function (_gl, semantic, val) {
	            var semanticInfo = this.uniformSemantics[semantic];
	            if (semanticInfo) {
	                return this.setUniform(_gl, semanticInfo.type, semanticInfo.symbol, val);
	            }
	            return false;
	        },

	        // Enable the attributes passed in and disable the rest
	        // Example Usage:
	        // enableAttributes(_gl, ["position", "texcoords"])
	        enableAttributes: function (_gl, attribList, vao) {

	            var program = this._cache.get('program');

	            var locationMap = this._cache.get('attriblocations');

	            var enabledAttributeListInContext;
	            if (vao) {
	                enabledAttributeListInContext = vao.__enabledAttributeList;
	            }
	            else {
	                enabledAttributeListInContext = enabledAttributeList[_gl.__GLID__];
	            }
	            if (! enabledAttributeListInContext) {
	                // In vertex array object context
	                // PENDING Each vao object needs to enable attributes again?
	                if (vao) {
	                    enabledAttributeListInContext
	                        = vao.__enabledAttributeList
	                        = [];
	                }
	                else {
	                    enabledAttributeListInContext
	                        = enabledAttributeList[_gl.__GLID__]
	                        = [];
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
	                    // Attrib location is a number from 0 to ...
	                    if (location === -1) {
	                        locationList[i] = -1;
	                        continue;
	                    }
	                    locationMap[symbol] = location;
	                }
	                locationList[i] = location;

	                if (!enabledAttributeListInContext[location]) {
	                    enabledAttributeListInContext[location] = SHADER_STATE_TO_ENABLE;
	                }
	                else {
	                    enabledAttributeListInContext[location] = SHADER_STATE_KEEP_ENABLE;
	                }
	            }

	            for (var i = 0; i < enabledAttributeListInContext.length; i++) {
	                switch(enabledAttributeListInContext[i]){
	                    case SHADER_STATE_TO_ENABLE:
	                        _gl.enableVertexAttribArray(i);
	                        enabledAttributeListInContext[i] = SHADER_STATE_PENDING;
	                        break;
	                    case SHADER_STATE_KEEP_ENABLE:
	                        enabledAttributeListInContext[i] = SHADER_STATE_PENDING;
	                        break;
	                    // Expired
	                    case SHADER_STATE_PENDING:
	                        _gl.disableVertexAttribArray(i);
	                        enabledAttributeListInContext[i] = 0;
	                        break;
	                }
	            }

	            return locationList;
	        },

	        _parseImport: function () {

	            this._vertexProcessedWithoutDefine = Shader.parseImport(this.vertex);
	            this._fragmentProcessedWithoutDefine = Shader.parseImport(this.fragment);

	        },

	        _addDefineExtensionAndPrecision: function (extensions) {

	            extensions = extensions || this.extensions;
	            // Extension declaration must before all non-preprocessor codes
	            // TODO vertex ? extension enum ?
	            var extensionStr = [];
	            for (var i = 0; i < extensions.length; i++) {
	                extensionStr.push('#extension GL_' + extensions[i] + ' : enable');
	            }

	            // Add defines
	            // VERTEX
	            var defineStr = this._getDefineStr(this.vertexDefines);
	            this._vertexProcessed = defineStr + '\n' + this._vertexProcessedWithoutDefine;

	            // FRAGMENT
	            var defineStr = this._getDefineStr(this.fragmentDefines);
	            var code = defineStr + '\n' + this._fragmentProcessedWithoutDefine;

	            // Add precision
	            this._fragmentProcessed = extensionStr.join('\n') + '\n'
	                + ['precision', this.precision, 'float'].join(' ') + ';\n'
	                + ['precision', this.precision, 'int'].join(' ') + ';\n'
	                // depth texture may have precision problem on iOS device.
	                + ['precision', this.precision, 'sampler2D'].join(' ') + ';\n'
	                + code;
	        },

	        _getDefineStr: function (defines) {

	            var lightNumber = this.lightNumber;
	            var textureStatus = this._textureStatus;
	            var defineStr = [];
	            for (var lightType in lightNumber) {
	                var count = lightNumber[lightType];
	                if (count > 0) {
	                    defineStr.push('#define ' + lightType.toUpperCase() + '_COUNT ' + count);
	                }
	            }
	            for (var symbol in textureStatus) {
	                var status = textureStatus[symbol];
	                if (status.enabled) {
	                    defineStr.push('#define ' + symbol.toUpperCase() + '_ENABLED');
	                }
	            }
	            // Custom Defines
	            for (var symbol in defines) {
	                var value = defines[symbol];
	                if (value === null) {
	                    defineStr.push('#define ' + symbol);
	                }
	                else{
	                    defineStr.push('#define ' + symbol + ' ' + value.toString());
	                }
	            }
	            return defineStr.join('\n');
	        },

	        _unrollLoop: function (shaderStr, defines) {
	            // Loop unroll from three.js, https://github.com/mrdoob/three.js/blob/master/src/renderers/webgl/WebGLProgram.js#L175
	            // In some case like shadowMap in loop use 'i' to index value much slower.

	            // Loop use _idx_ and increased with _idx_++ will be unrolled
	            // Use {{ }} to match the pair so the if statement will not be affected
	            // Write like following
	            // for (int _idx_ = 0; _idx_ < 4; _idx_++) {{
	            //     vec3 color = texture2D(textures[_idx_], uv).rgb;
	            // }}
	            function replace(match, start, end, snippet) {
	                var unroll = '';
	                // Try to treat as define
	                if (isNaN(start)) {
	                    if (start in defines) {
	                        start = defines[start];
	                    }
	                    else {
	                        start = lightNumberDefines[start];
	                    }
	                }
	                if (isNaN(end)) {
	                    if (end in defines) {
	                        end = defines[end];
	                    }
	                    else {
	                        end = lightNumberDefines[end];
	                    }
	                }
	                // TODO Error checking

	                for (var idx = parseInt(start); idx < parseInt(end); idx++) {
	                    // PENDING Add scope?
	                    unroll += '{'
	                        + snippet
	                            .replace(/float\s*\(\s*_idx_\s*\)/g, idx.toFixed(1))
	                            .replace(/_idx_/g, idx)
	                    + '\n' + '}';
	                }

	                return unroll;
	            }

	            var lightNumberDefines = {};
	            for (var lightType in this.lightNumber) {
	                lightNumberDefines[lightType + '_COUNT'] = this.lightNumber[lightType];
	            }
	            return shaderStr.replace(loopRegex, replace);
	        },

	        _parseUniforms: function () {
	            var uniforms = {};
	            var self = this;
	            var shaderType = 'vertex';
	            this._uniformList = [];

	            this._vertexProcessedWithoutDefine = this._vertexProcessedWithoutDefine.replace(uniformRegex, _uniformParser);
	            shaderType = 'fragment';
	            this._fragmentProcessedWithoutDefine = this._fragmentProcessedWithoutDefine.replace(uniformRegex, _uniformParser);

	            self.matrixSemanticKeys = Object.keys(this.matrixSemantics);

	            function _uniformParser(str, type, symbol, isArray, semanticWrapper, semantic) {
	                if (type && symbol) {
	                    var uniformType = uniformTypeMap[type];
	                    var isConfigurable = true;
	                    var defaultValueFunc;
	                    if (uniformType) {
	                        self._uniformList.push(symbol);
	                        if (type === 'sampler2D' || type === 'samplerCube') {
	                            // Texture is default disabled
	                            self._textureStatus[symbol] = {
	                                enabled: false,
	                                shaderType: shaderType
	                            };
	                        }
	                        if (isArray) {
	                            uniformType += 'v';
	                        }
	                        if (semantic) {
	                            // This case is only for SKIN_MATRIX
	                            // TODO
	                            if (attribSemantics.indexOf(semantic) >= 0) {
	                                self.attribSemantics[semantic] = {
	                                    symbol: symbol,
	                                    type: uniformType
	                                };
	                                isConfigurable = false;
	                            }
	                            else if (matrixSemantics.indexOf(semantic) >= 0) {
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
	                            }
	                            else if (uniformSemantics.indexOf(semantic) >= 0) {
	                                self.uniformSemantics[semantic] = {
	                                    symbol: symbol,
	                                    type: uniformType
	                                };
	                                isConfigurable = false;
	                            }
	                            else {
	                                // The uniform is not configurable, which means it will not appear
	                                // in the material uniform properties
	                                if (semantic === 'unconfigurable') {
	                                    isConfigurable = false;
	                                }
	                                else {
	                                    // Uniform have a defalut value, like
	                                    // uniform vec3 color: [1, 1, 1];
	                                    defaultValueFunc = self._parseDefaultValue(type, semantic);
	                                    if (!defaultValueFunc) {
	                                        throw new Error('Unkown semantic "' + semantic + '"');
	                                    }
	                                    else {
	                                        semantic = '';
	                                    }
	                                }
	                            }
	                        }

	                        if (isConfigurable) {
	                            uniforms[symbol] = {
	                                type: uniformType,
	                                value: isArray ? uniformValueConstructor['array'] : (defaultValueFunc || uniformValueConstructor[type]),
	                                semantic: semantic || null
	                            };
	                        }
	                    }
	                    return ['uniform', type, symbol, isArray].join(' ') + ';\n';
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
	                        return new vendor.Float32Array(arr);
	                    };
	                }
	                else {
	                    // Invalid value
	                    return;
	                }
	            }
	            else if (type === 'bool') {
	                return function () {
	                    return str.toLowerCase() === 'true' ? true : false;
	                };
	            }
	            else if (type === 'float') {
	                return function () {
	                    return parseFloat(str);
	                };
	            }
	            else if (type === 'int') {
	                return function () {
	                    return parseInt(str);
	                };
	            }
	        },

	        // Create a new uniform instance for material
	        createUniforms: function () {
	            var uniforms = {};

	            for (var symbol in this.uniformTemplates){
	                var uniformTpl = this.uniformTemplates[symbol];
	                uniforms[symbol] = {
	                    type: uniformTpl.type,
	                    value: uniformTpl.value()
	                };
	            }

	            return uniforms;
	        },

	        // Attached to material
	        attached: function () {
	            this._attacheMaterialNumber++;
	        },

	        // Detached to material
	        detached: function () {
	            this._attacheMaterialNumber--;
	        },

	        isAttachedToAny: function () {
	            return this._attacheMaterialNumber !== 0;
	        },

	        _parseAttributes: function () {
	            var attributes = {};
	            var self = this;
	            this._vertexProcessedWithoutDefine = this._vertexProcessedWithoutDefine.replace(
	                attributeRegex, _attributeParser
	            );

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
	                        // Can only be float
	                        type: 'float',
	                        size: size,
	                        semantic: semantic || null
	                    };

	                    if (semantic) {
	                        if (attribSemantics.indexOf(semantic) < 0) {
	                            throw new Error('Unkown semantic "' + semantic + '"');
	                        }
	                        else {
	                            self.attribSemantics[semantic] = {
	                                symbol: symbol,
	                                type: type
	                            };
	                        }
	                    }
	                }

	                return ['attribute', type, symbol].join(' ') + ';\n';
	            }

	            this.attributeTemplates = attributes;
	        },

	        _parseDefines: function () {
	            var self = this;
	            var shaderType = 'vertex';
	            this._vertexProcessedWithoutDefine = this._vertexProcessedWithoutDefine.replace(defineRegex, _defineParser);
	            shaderType = 'fragment';
	            this._fragmentProcessedWithoutDefine = this._fragmentProcessedWithoutDefine.replace(defineRegex, _defineParser);

	            function _defineParser(str, symbol, value) {
	                var defines = shaderType === 'vertex' ? self.vertexDefines : self.fragmentDefines;
	                if (!defines[symbol]) { // Haven't been defined by user
	                    if (value == 'false') {
	                        defines[symbol] = false;
	                    }
	                    else if (value == 'true') {
	                        defines[symbol] = true;
	                    }
	                    else {
	                        defines[symbol] = value ? parseFloat(value) : null;
	                    }
	                }
	                return '';
	            }
	        },

	        // Return true or error msg if error happened
	        _buildProgram: function (_gl, vertexShaderString, fragmentShaderString) {
	            var cache = this._cache;
	            if (cache.get('program')) {
	                _gl.deleteProgram(cache.get('program'));
	            }
	            var program = _gl.createProgram();

	            var vertexShader = _gl.createShader(_gl.VERTEX_SHADER);
	            _gl.shaderSource(vertexShader, vertexShaderString);
	            _gl.compileShader(vertexShader);

	            var fragmentShader = _gl.createShader(_gl.FRAGMENT_SHADER);
	            _gl.shaderSource(fragmentShader, fragmentShaderString);
	            _gl.compileShader(fragmentShader);

	            var msg = checkShaderErrorMsg(_gl, vertexShader, vertexShaderString);
	            if (msg) {
	                return msg;
	            }
	            msg = checkShaderErrorMsg(_gl, fragmentShader, fragmentShaderString);
	            if (msg) {
	                return msg;
	            }

	            _gl.attachShader(program, vertexShader);
	            _gl.attachShader(program, fragmentShader);
	            // Force the position bind to location 0;
	            if (this.attribSemantics['POSITION']) {
	                _gl.bindAttribLocation(program, 0, this.attribSemantics['POSITION'].symbol);
	            }
	            else {
	                // Else choose an attribute and bind to location 0;
	                var keys = Object.keys(this.attributeTemplates);
	                _gl.bindAttribLocation(program, 0, keys[0]);
	            }

	            _gl.linkProgram(program);

	            if (!_gl.getProgramParameter(program, _gl.LINK_STATUS)) {
	                return 'Could not link program\n' + 'VALIDATE_STATUS: ' + _gl.getProgramParameter(program, _gl.VALIDATE_STATUS) + ', gl error [' + _gl.getError() + ']';
	            }

	            // Cache uniform locations
	            for (var i = 0; i < this._uniformList.length; i++) {
	                var uniformSymbol = this._uniformList[i];
	                var locationMap = cache.get('locations');
	                locationMap[uniformSymbol] = _gl.getUniformLocation(program, uniformSymbol);
	            }

	            _gl.deleteShader(vertexShader);
	            _gl.deleteShader(fragmentShader);

	            cache.put('program', program);
	        },

	        /**
	         * Clone a new shader
	         * @return {qtek.Shader}
	         */
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
	        /**
	         * Dispose given context
	         * @param  {WebGLRenderingContext} _gl
	         */
	        dispose: function (_gl) {
	            var cache = this._cache;

	            cache.use(_gl.__GLID__);
	            var program = cache.get('program');
	            if (program) {
	                _gl.deleteProgram(program);
	            }
	            cache.deleteContext(_gl.__GLID__);

	            this._locations = {};
	        }
	    });

	    function getCacheSchema() {
	        return {
	            locations: {},
	            attriblocations: {}
	        };
	    }

	    // Return true or error msg if error happened
	    function checkShaderErrorMsg(_gl, shader, shaderString) {
	        if (!_gl.getShaderParameter(shader, _gl.COMPILE_STATUS)) {
	            return [_gl.getShaderInfoLog(shader), addLineNumbers(shaderString)].join('\n');
	        }
	    }

	    // some util functions
	    function addLineNumbers(string) {
	        var chunks = string.split('\n');
	        for (var i = 0, il = chunks.length; i < il; i ++) {
	            // Chrome reports shader errors on lines
	            // starting counting from 1
	            chunks[i] = (i + 1) + ': ' + chunks[i];
	        }
	        return chunks.join('\n');
	    }

	    var importRegex = /(@import)\s*([0-9a-zA-Z_\-\.]*)/g;
	    Shader.parseImport = function (shaderStr) {
	        shaderStr = shaderStr.replace(importRegex, function (str, importSymbol, importName) {
	            var str = Shader.source(importName);
	            if (str) {
	                // Recursively parse
	                return Shader.parseImport(str);
	            }
	            else {
	                console.warn('Shader chunk "' + importName + '" not existed in library');
	                return '';
	            }
	        });
	        return shaderStr;
	    };

	    var exportRegex = /(@export)\s*([0-9a-zA-Z_\-\.]*)\s*\n([\s\S]*?)@end/g;

	    /**
	     * Import shader source
	     * @param  {string} shaderStr
	     * @memberOf qtek.Shader
	     */
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

	    /**
	     * Library to store all the loaded shader codes
	     * @type {Object}
	     * @readOnly
	     * @memberOf qtek.Shader
	     */
	    Shader.codes = {};

	    /**
	     * Get shader source
	     * @param  {string} name
	     * @return {string}
	     * @memberOf qtek.Shader
	     */
	    Shader.source = function (name) {
	        var parts = name.split('.');
	        var obj = Shader.codes;
	        var i = 0;
	        while (obj && i < parts.length) {
	            var key = parts[i++];
	            obj = obj[key];
	        }
	        if (typeof obj !== 'string') {
	            // FIXME Use default instead
	            console.warn('Shader "' + name + '" not existed in library');
	            return '';
	        }
	        return obj;
	    };

	    module.exports = Shader;


/***/ },
/* 19 */
/***/ function(module, exports) {

	'use strict';


	    var DIRTY_PREFIX = '__dirty__';

	    var Cache = function () {

	        this._contextId = 0;

	        this._caches = [];

	        this._context = {};
	    };

	    Cache.prototype = {

	        use: function (contextId, documentSchema) {
	            var caches = this._caches;
	            if (!caches[contextId]) {
	                caches[contextId] = {};

	                if (documentSchema) {
	                    caches[contextId] = documentSchema();
	                }
	            }
	            this._contextId = contextId;

	            this._context = caches[contextId];
	        },

	        put: function (key, value) {
	            this._context[key] = value;
	        },

	        get: function (key) {
	            return this._context[key];
	        },

	        dirty: function (field) {
	            field = field || '';
	            var key = DIRTY_PREFIX + field;
	            this.put(key, true);
	        },

	        dirtyAll: function (field) {
	            field = field || '';
	            var key = DIRTY_PREFIX + field;
	            var caches = this._caches;
	            for (var i = 0; i < caches.length; i++) {
	                if (caches[i]) {
	                    caches[i][key] = true;
	                }
	            }
	        },

	        fresh: function (field) {
	            field = field || '';
	            var key = DIRTY_PREFIX + field;
	            this.put(key, false);
	        },

	        freshAll: function (field) {
	            field = field || '';
	            var key = DIRTY_PREFIX + field;
	            var caches = this._caches;
	            for (var i = 0; i < caches.length; i++) {
	                if (caches[i]) {
	                    caches[i][key] = false;
	                }
	            }
	        },

	        isDirty: function (field) {
	            field = field || '';
	            var key = DIRTY_PREFIX + field;
	            var context = this._context;
	            return  !context.hasOwnProperty(key)
	                || context[key] === true;
	        },

	        deleteContext: function (contextId) {
	            delete this._caches[contextId];
	            this._context = {};
	        },

	        delete: function (key) {
	            delete this._context[key];
	        },

	        clearAll: function () {
	            this._caches = {};
	        },

	        getContext: function () {
	            return this._context;
	        },

	        eachContext : function (cb, context) {
	            var keys = Object.keys(this._caches);
	            keys.forEach(function (key) {
	                cb && cb.call(context, key);
	            });
	        },

	        miss: function (key) {
	            return ! this._context.hasOwnProperty(key);
	        }
	    };

	    Cache.prototype.constructor = Cache;

	    module.exports = Cache;



/***/ },
/* 20 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';


	    var Base = __webpack_require__(6);
	    var Texture = __webpack_require__(21);

	    /**
	     * @constructor qtek.Material
	     * @extends qtek.core.Base
	     */
	    var Material = Base.extend(
	    /** @lends qtek.Material# */
	    {
	        /**
	         * @type {string}
	         */
	        name: '',

	        /**
	         * @type {Object}
	         */
	        // uniforms: null,

	        /**
	         * @type {qtek.Shader}
	         */
	        // shader: null,

	        /**
	         * @type {boolean}
	         */
	        depthTest: true,

	        /**
	         * @type {boolean}
	         */
	        depthMask: true,

	        /**
	         * @type {boolean}
	         */
	        transparent: false,
	        /**
	         * Blend func is a callback function when the material
	         * have custom blending
	         * The gl context will be the only argument passed in tho the
	         * blend function
	         * Detail of blend function in WebGL:
	         * http://www.khronos.org/registry/gles/specs/2.0/es_full_spec_2.0.25.pdf
	         *
	         * Example :
	         * function(_gl) {
	         *  _gl.blendEquation(_gl.FUNC_ADD);
	         *  _gl.blendFunc(_gl.SRC_ALPHA, _gl.ONE_MINUS_SRC_ALPHA);
	         * }
	         */
	        blend: null,

	        // shadowTransparentMap : null

	        _enabledUniforms: null,
	    }, function () {
	        if (!this.name) {
	            this.name = 'MATERIAL_' + this.__GUID__;
	        }
	        if (this.shader) {
	            this.attachShader(this.shader);
	        }
	        if (! this.uniforms) {
	            this.uniforms = {};
	        }
	    },
	    /** @lends qtek.Material.prototype */
	    {

	        bind: function(_gl, prevMaterial) {

	            var sameShader = prevMaterial && prevMaterial.shader === this.shader;

	            var shader = this.shader;

	            if (sameShader) {
	                // shader may use some slot by others before material bind.
	                shader.resetTextureSlot(prevMaterial.__textureSlotBase || 0);
	            }
	            this.__textureSlotBase = shader.currentTextureSlot();

	            // Set uniforms
	            for (var u = 0; u < this._enabledUniforms.length; u++) {
	                var symbol = this._enabledUniforms[u];
	                var uniform = this.uniforms[symbol];
	                var uniformValue = uniform.value;
	                // When binding two materials with the same shader
	                // Many uniforms will be be set twice even if they have the same value
	                // So add a evaluation to see if the uniform is really needed to be set
	                if (sameShader) {
	                    if (prevMaterial.uniforms[symbol].value === uniformValue) {
	                        continue;
	                    }
	                }

	                if (uniformValue === undefined) {
	                    console.warn('Uniform value "' + symbol + '" is undefined');
	                    continue;
	                }
	                else if (uniformValue === null) {
	                    // FIXME Assume material with same shader have same order uniforms
	                    // Or if different material use same textures,
	                    // the slot will be different and still skipped because optimization
	                    if (uniform.type === 't') {
	                        var slot = shader.currentTextureSlot();
	                        var res = shader.setUniform(_gl, '1i', symbol, slot);
	                        if (res) { // Texture is enabled
	                            // Still occupy the slot to make sure same texture in different materials have same slot.
	                            shader.useCurrentTextureSlot(_gl, null);
	                        }
	                    }
	                    continue;
	                }
	                else if (uniformValue instanceof Array
	                    && !uniformValue.length) {
	                    continue;
	                }
	                else if (uniformValue instanceof Texture) {
	                    var slot = shader.currentTextureSlot();
	                    var res = shader.setUniform(_gl, '1i', symbol, slot);
	                    if (!res) { // Texture is not enabled
	                        continue;
	                    }
	                    shader.useCurrentTextureSlot(_gl, uniformValue);
	                }
	                else if (uniformValue instanceof Array) {
	                    if (uniformValue.length === 0) {
	                        continue;
	                    }
	                    // Texture Array
	                    var exampleValue = uniformValue[0];

	                    if (exampleValue instanceof Texture) {
	                        if (!shader.hasUniform(symbol)) {
	                            continue;
	                        }

	                        var arr = [];
	                        for (var i = 0; i < uniformValue.length; i++) {
	                            var texture = uniformValue[i];

	                            var slot = shader.currentTextureSlot();
	                            arr.push(slot);

	                            shader.useCurrentTextureSlot(_gl, texture);
	                        }

	                        shader.setUniform(_gl, '1iv', symbol, arr);
	                    }
	                    else {
	                        shader.setUniform(_gl, uniform.type, symbol, uniformValue);
	                    }
	                }
	                else{
	                    shader.setUniform(_gl, uniform.type, symbol, uniformValue);
	                }
	            }
	        },

	        /**
	         * @param {string} symbol
	         * @param {number|array|qtek.Texture|ArrayBufferView} value
	         */
	        setUniform: function (symbol, value) {
	            if (value === undefined) {
	                console.warn('Uniform value "' + symbol + '" is undefined');
	            }
	            var uniform = this.uniforms[symbol];
	            if (uniform) {
	                uniform.value = value;
	            }
	        },

	        /**
	         * @param {Object} obj
	         */
	        setUniforms: function(obj) {
	            for (var key in obj) {
	                var val = obj[key];
	                this.setUniform(key, val);
	            }
	        },

	        /**
	         * Enable a uniform
	         * It only have effect on the uniform exists in shader.
	         * @param  {string} symbol
	         */
	        // enableUniform: function (symbol) {
	        //     if (this.uniforms[symbol] && !this.isUniformEnabled(symbol)) {
	        //         this._enabledUniforms.push(symbol);
	        //     }
	        // },

	        // /**
	        //  * Disable a uniform
	        //  * It will not affect the uniform state in the shader. Because the shader uniforms is parsed from shader code with naive regex. When using micro to disable some uniforms in the shader. It will still try to set these uniforms in each rendering pass. We can disable these uniforms manually if we need this bit performance improvement. Mostly we can simply ignore it.
	        //  * @param  {string} symbol
	        //  */
	        // disableUniform: function (symbol) {
	        //     var idx = this._enabledUniforms.indexOf(symbol);
	        //     if (idx >= 0) {
	        //         this._enabledUniforms.splice(idx, 1);
	        //     }
	        // },

	        /**
	         * @param  {string}  symbol
	         * @return {boolean}
	         */
	        isUniformEnabled: function (symbol) {
	            return this._enabledUniforms.indexOf(symbol) >= 0;
	        },

	        /**
	         * Alias of setUniform and setUniforms
	         * @param {object|string} symbol
	         * @param {number|array|qtek.Texture|ArrayBufferView} [value]
	         */
	        set: function (symbol, value) {
	            if (typeof(symbol) === 'object') {
	                for (var key in symbol) {
	                    var val = symbol[key];
	                    this.set(key, val);
	                }
	            }
	            else {
	                var uniform = this.uniforms[symbol];
	                if (uniform) {
	                    uniform.value = value;
	                }
	            }
	        },
	        /**
	         * Get uniform value
	         * @param  {string} symbol
	         * @return {number|array|qtek.Texture|ArrayBufferView}
	         */
	        get: function (symbol) {
	            var uniform = this.uniforms[symbol];
	            if (uniform) {
	                return uniform.value;
	            }
	        },
	        /**
	         * Attach a shader instance
	         * @param  {qtek.Shader} shader
	         * @param  {boolean} keepUniform If try to keep uniform value
	         */
	        attachShader: function(shader, keepUniform) {
	            if (this.shader) {
	                this.shader.detached();
	            }

	            var originalUniforms = this.uniforms;

	            // Ignore if uniform can use in shader.
	            this.uniforms = shader.createUniforms();
	            this.shader = shader;

	            var uniforms = this.uniforms;
	            this._enabledUniforms = Object.keys(uniforms);
	            // Make sure uniforms are set in same order to avoid texture slot wrong
	            this._enabledUniforms.sort();

	            if (keepUniform) {
	                for (var symbol in originalUniforms) {
	                    if (uniforms[symbol]) {
	                        uniforms[symbol].value = originalUniforms[symbol].value;
	                    }
	                }
	            }

	            shader.attached();
	        },

	        /**
	         * Detach a shader instance
	         */
	        detachShader: function() {
	            this.shader.detached();
	            this.shader = null;
	            this.uniforms = {};
	        },

	        /**
	         * Clone a new material and keep uniforms, shader will not be cloned
	         * @return {qtek.Material}
	         */
	        clone: function () {
	            var material = new this.constructor({
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

	        /**
	         * Dispose material, if material shader is not attached to any other materials
	         * Shader will also be disposed
	         * @param {WebGLRenderingContext} gl
	         * @param {boolean} [disposeTexture=false] If dispose the textures used in the material
	         */
	        dispose: function(_gl, disposeTexture) {
	            if (disposeTexture) {
	                for (var name in this.uniforms) {
	                    var val = this.uniforms[name].value;
	                    if (!val) {
	                        continue;
	                    }
	                    if (val instanceof Texture) {
	                        val.dispose(_gl);
	                    }
	                    else if (val instanceof Array) {
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

	    module.exports = Material;


/***/ },
/* 21 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	/**
	 * Base class for all textures like compressed texture, texture2d, texturecube
	 * TODO mapping
	 */


	    var Base = __webpack_require__(6);
	    var glenum = __webpack_require__(11);
	    var Cache = __webpack_require__(19);

	    /**
	     * @constructor qtek.Texture
	     * @extends qtek.core.Base
	     */
	    var Texture = Base.extend(
	    /** @lends qtek.Texture# */
	    {
	        /**
	         * Texture width, only needed when the texture is used as a render target
	         * @type {number}
	         */
	        width: 512,
	        /**
	         * Texture height, only needed when the texture is used as a render target
	         * @type {number}
	         */
	        height: 512,
	        /**
	         * Texel data type
	         * @type {number}
	         */
	        type: glenum.UNSIGNED_BYTE,
	        /**
	         * Format of texel data
	         * @type {number}
	         */
	        format: glenum.RGBA,
	        /**
	         * @type {number}
	         */
	        wrapS: glenum.CLAMP_TO_EDGE,
	        /**
	         * @type {number}
	         */
	        wrapT: glenum.CLAMP_TO_EDGE,
	        /**
	         * @type {number}
	         */
	        minFilter: glenum.LINEAR_MIPMAP_LINEAR,
	        /**
	         * @type {number}
	         */
	        magFilter: glenum.LINEAR,
	        /**
	         * @type {boolean}
	         */
	        useMipmap: true,

	        /**
	         * Anisotropic filtering, enabled if value is larger than 1
	         * @see http://blog.tojicode.com/2012/03/anisotropic-filtering-in-webgl.html
	         * @type {number}
	         */
	        anisotropic: 1,
	        // pixelStorei parameters, not available when texture is used as render target
	        // http://www.khronos.org/opengles/sdk/docs/man/xhtml/glPixelStorei.xml
	        /**
	         * @type {boolean}
	         */
	        flipY: true,
	        /**
	         * @type {number}
	         */
	        unpackAlignment: 4,
	        /**
	         * @type {boolean}
	         */
	        premultiplyAlpha: false,

	        /**
	         * Dynamic option for texture like video
	         * @type {boolean}
	         */
	        dynamic: false,

	        NPOT: false
	    }, function () {
	        this._cache = new Cache();
	    },
	    /** @lends qtek.Texture.prototype */
	    {

	        getWebGLTexture: function (_gl) {
	            var cache = this._cache;
	            cache.use(_gl.__GLID__);

	            if (cache.miss('webgl_texture')) {
	                // In a new gl context, create new texture and set dirty true
	                cache.put('webgl_texture', _gl.createTexture());
	            }
	            if (this.dynamic) {
	                this.update(_gl);
	            }
	            else if (cache.isDirty()) {
	                this.update(_gl);
	                cache.fresh();
	            }

	            return cache.get('webgl_texture');
	        },

	        bind: function () {},
	        unbind: function () {},

	        /**
	         * Mark texture is dirty and update in the next frame
	         */
	        dirty: function () {
	            this._cache.dirtyAll();
	        },

	        update: function (_gl) {},

	        // Update the common parameters of texture
	        beforeUpdate: function (_gl) {
	            _gl.pixelStorei(_gl.UNPACK_FLIP_Y_WEBGL, this.flipY);
	            _gl.pixelStorei(_gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, this.premultiplyAlpha);
	            _gl.pixelStorei(_gl.UNPACK_ALIGNMENT, this.unpackAlignment);

	            this.fallBack();
	        },

	        fallBack: function () {
	            // Use of none-power of two texture
	            // http://www.khronos.org/webgl/wiki/WebGL_and_OpenGL_Differences

	            var isPowerOfTwo = this.isPowerOfTwo();

	            if (this.format === glenum.DEPTH_COMPONENT) {
	                this.useMipmap = false;
	            }

	            if (!isPowerOfTwo || !this.useMipmap) {
	                // none-power of two flag
	                this.NPOT = true;
	                // Save the original value for restore
	                this._minFilterOriginal = this.minFilter;
	                this._magFilterOriginal = this.magFilter;
	                this._wrapSOriginal = this.wrapS;
	                this._wrapTOriginal = this.wrapT;

	                if (this.minFilter == glenum.NEAREST_MIPMAP_NEAREST ||
	                    this.minFilter == glenum.NEAREST_MIPMAP_LINEAR) {
	                    this.minFilter = glenum.NEAREST;
	                } else if (
	                    this.minFilter == glenum.LINEAR_MIPMAP_LINEAR ||
	                    this.minFilter == glenum.LINEAR_MIPMAP_NEAREST
	                ) {
	                    this.minFilter = glenum.LINEAR;
	                }

	                this.wrapS = glenum.CLAMP_TO_EDGE;
	                this.wrapT = glenum.CLAMP_TO_EDGE;
	            }
	            else {
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
	        /**
	         * @param  {WebGLRenderingContext} _gl
	         */
	        dispose: function (_gl) {

	            var cache = this._cache;

	            cache.use(_gl.__GLID__);

	            var webglTexture = cache.get('webgl_texture');
	            if (webglTexture){
	                _gl.deleteTexture(webglTexture);
	            }
	            cache.deleteContext(_gl.__GLID__);

	        },
	        /**
	         * Test if image of texture is valid and loaded.
	         * @return {boolean}
	         */
	        isRenderable: function () {},

	        isPowerOfTwo: function () {}
	    });

	    /* DataType */
	    Texture.BYTE = glenum.BYTE;
	    Texture.UNSIGNED_BYTE = glenum.UNSIGNED_BYTE;
	    Texture.SHORT = glenum.SHORT;
	    Texture.UNSIGNED_SHORT = glenum.UNSIGNED_SHORT;
	    Texture.INT = glenum.INT;
	    Texture.UNSIGNED_INT = glenum.UNSIGNED_INT;
	    Texture.FLOAT = glenum.FLOAT;
	    Texture.HALF_FLOAT = 0x8D61;

	    // ext.UNSIGNED_INT_24_8_WEBGL for WEBGL_depth_texture extension
	    Texture.UNSIGNED_INT_24_8_WEBGL = 34042;

	    /* PixelFormat */
	    Texture.DEPTH_COMPONENT = glenum.DEPTH_COMPONENT;
	    Texture.DEPTH_STENCIL = glenum.DEPTH_STENCIL;
	    Texture.ALPHA = glenum.ALPHA;
	    Texture.RGB = glenum.RGB;
	    Texture.RGBA = glenum.RGBA;
	    Texture.LUMINANCE = glenum.LUMINANCE;
	    Texture.LUMINANCE_ALPHA = glenum.LUMINANCE_ALPHA;

	    /* Compressed Texture */
	    Texture.COMPRESSED_RGB_S3TC_DXT1_EXT = 0x83F0;
	    Texture.COMPRESSED_RGBA_S3TC_DXT1_EXT = 0x83F1;
	    Texture.COMPRESSED_RGBA_S3TC_DXT3_EXT = 0x83F2;
	    Texture.COMPRESSED_RGBA_S3TC_DXT5_EXT = 0x83F3;

	    /* TextureMagFilter */
	    Texture.NEAREST = glenum.NEAREST;
	    Texture.LINEAR = glenum.LINEAR;

	    /* TextureMinFilter */
	    /*      NEAREST */
	    /*      LINEAR */
	    Texture.NEAREST_MIPMAP_NEAREST = glenum.NEAREST_MIPMAP_NEAREST;
	    Texture.LINEAR_MIPMAP_NEAREST = glenum.LINEAR_MIPMAP_NEAREST;
	    Texture.NEAREST_MIPMAP_LINEAR = glenum.NEAREST_MIPMAP_LINEAR;
	    Texture.LINEAR_MIPMAP_LINEAR = glenum.LINEAR_MIPMAP_LINEAR;

	    /* TextureParameterName */
	    // Texture.TEXTURE_MAG_FILTER = glenum.TEXTURE_MAG_FILTER;
	    // Texture.TEXTURE_MIN_FILTER = glenum.TEXTURE_MIN_FILTER;

	    /* TextureWrapMode */
	    Texture.REPEAT = glenum.REPEAT;
	    Texture.CLAMP_TO_EDGE = glenum.CLAMP_TO_EDGE;
	    Texture.MIRRORED_REPEAT = glenum.MIRRORED_REPEAT;


	    module.exports = Texture;


/***/ },
/* 22 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';


	    var glMatrix = __webpack_require__(15);
	    var vec2 = glMatrix.vec2;

	    /**
	     * @constructor
	     * @alias qtek.math.Vector2
	     * @param {number} x
	     * @param {number} y
	     */
	    var Vector2 = function(x, y) {

	        x = x || 0;
	        y = y || 0;

	        /**
	         * Storage of Vector2, read and write of x, y will change the values in _array
	         * All methods also operate on the _array instead of x, y components
	         * @name _array
	         * @type {Float32Array}
	         */
	        this._array = vec2.fromValues(x, y);

	        /**
	         * Dirty flag is used by the Node to determine
	         * if the matrix is updated to latest
	         * @name _dirty
	         * @type {boolean}
	         */
	        this._dirty = true;
	    };

	    Vector2.prototype = {

	        constructor: Vector2,

	        /**
	         * Add b to self
	         * @param  {qtek.math.Vector2} b
	         * @return {qtek.math.Vector2}
	         */
	        add: function(b) {
	            vec2.add(this._array, this._array, b._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Set x and y components
	         * @param  {number}  x
	         * @param  {number}  y
	         * @return {qtek.math.Vector2}
	         */
	        set: function(x, y) {
	            this._array[0] = x;
	            this._array[1] = y;
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Set x and y components from array
	         * @param  {Float32Array|number[]} arr
	         * @return {qtek.math.Vector2}
	         */
	        setArray: function(arr) {
	            this._array[0] = arr[0];
	            this._array[1] = arr[1];

	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Clone a new Vector2
	         * @return {qtek.math.Vector2}
	         */
	        clone: function() {
	            return new Vector2(this.x, this.y);
	        },

	        /**
	         * Copy x, y from b
	         * @param  {qtek.math.Vector2} b
	         * @return {qtek.math.Vector2}
	         */
	        copy: function(b) {
	            vec2.copy(this._array, b._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Cross product of self and b, written to a Vector3 out
	         * @param  {qtek.math.Vector3} out
	         * @param  {qtek.math.Vector2} b
	         * @return {qtek.math.Vector2}
	         */
	        cross: function(out, b) {
	            vec2.cross(out._array, this._array, b._array);
	            out._dirty = true;
	            return this;
	        },

	        /**
	         * Alias for distance
	         * @param  {qtek.math.Vector2} b
	         * @return {number}
	         */
	        dist: function(b) {
	            return vec2.dist(this._array, b._array);
	        },

	        /**
	         * Distance between self and b
	         * @param  {qtek.math.Vector2} b
	         * @return {number}
	         */
	        distance: function(b) {
	            return vec2.distance(this._array, b._array);
	        },

	        /**
	         * Alias for divide
	         * @param  {qtek.math.Vector2} b
	         * @return {qtek.math.Vector2}
	         */
	        div: function(b) {
	            vec2.div(this._array, this._array, b._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Divide self by b
	         * @param  {qtek.math.Vector2} b
	         * @return {qtek.math.Vector2}
	         */
	        divide: function(b) {
	            vec2.divide(this._array, this._array, b._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Dot product of self and b
	         * @param  {qtek.math.Vector2} b
	         * @return {number}
	         */
	        dot: function(b) {
	            return vec2.dot(this._array, b._array);
	        },

	        /**
	         * Alias of length
	         * @return {number}
	         */
	        len: function() {
	            return vec2.len(this._array);
	        },

	        /**
	         * Calculate the length
	         * @return {number}
	         */
	        length: function() {
	            return vec2.length(this._array);
	        },

	        /**
	         * Linear interpolation between a and b
	         * @param  {qtek.math.Vector2} a
	         * @param  {qtek.math.Vector2} b
	         * @param  {number}  t
	         * @return {qtek.math.Vector2}
	         */
	        lerp: function(a, b, t) {
	            vec2.lerp(this._array, a._array, b._array, t);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Minimum of self and b
	         * @param  {qtek.math.Vector2} b
	         * @return {qtek.math.Vector2}
	         */
	        min: function(b) {
	            vec2.min(this._array, this._array, b._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Maximum of self and b
	         * @param  {qtek.math.Vector2} b
	         * @return {qtek.math.Vector2}
	         */
	        max: function(b) {
	            vec2.max(this._array, this._array, b._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Alias for multiply
	         * @param  {qtek.math.Vector2} b
	         * @return {qtek.math.Vector2}
	         */
	        mul: function(b) {
	            vec2.mul(this._array, this._array, b._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Mutiply self and b
	         * @param  {qtek.math.Vector2} b
	         * @return {qtek.math.Vector2}
	         */
	        multiply: function(b) {
	            vec2.multiply(this._array, this._array, b._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Negate self
	         * @return {qtek.math.Vector2}
	         */
	        negate: function() {
	            vec2.negate(this._array, this._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Normalize self
	         * @return {qtek.math.Vector2}
	         */
	        normalize: function() {
	            vec2.normalize(this._array, this._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Generate random x, y components with a given scale
	         * @param  {number} scale
	         * @return {qtek.math.Vector2}
	         */
	        random: function(scale) {
	            vec2.random(this._array, scale);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Scale self
	         * @param  {number}  scale
	         * @return {qtek.math.Vector2}
	         */
	        scale: function(s) {
	            vec2.scale(this._array, this._array, s);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Scale b and add to self
	         * @param  {qtek.math.Vector2} b
	         * @param  {number}  scale
	         * @return {qtek.math.Vector2}
	         */
	        scaleAndAdd: function(b, s) {
	            vec2.scaleAndAdd(this._array, this._array, b._array, s);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Alias for squaredDistance
	         * @param  {qtek.math.Vector2} b
	         * @return {number}
	         */
	        sqrDist: function(b) {
	            return vec2.sqrDist(this._array, b._array);
	        },

	        /**
	         * Squared distance between self and b
	         * @param  {qtek.math.Vector2} b
	         * @return {number}
	         */
	        squaredDistance: function(b) {
	            return vec2.squaredDistance(this._array, b._array);
	        },

	        /**
	         * Alias for squaredLength
	         * @return {number}
	         */
	        sqrLen: function() {
	            return vec2.sqrLen(this._array);
	        },

	        /**
	         * Squared length of self
	         * @return {number}
	         */
	        squaredLength: function() {
	            return vec2.squaredLength(this._array);
	        },

	        /**
	         * Alias for subtract
	         * @param  {qtek.math.Vector2} b
	         * @return {qtek.math.Vector2}
	         */
	        sub: function(b) {
	            vec2.sub(this._array, this._array, b._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Subtract b from self
	         * @param  {qtek.math.Vector2} b
	         * @return {qtek.math.Vector2}
	         */
	        subtract: function(b) {
	            vec2.subtract(this._array, this._array, b._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Transform self with a Matrix2 m
	         * @param  {qtek.math.Matrix2} m
	         * @return {qtek.math.Vector2}
	         */
	        transformMat2: function(m) {
	            vec2.transformMat2(this._array, this._array, m._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Transform self with a Matrix2d m
	         * @param  {qtek.math.Matrix2d} m
	         * @return {qtek.math.Vector2}
	         */
	        transformMat2d: function(m) {
	            vec2.transformMat2d(this._array, this._array, m._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Transform self with a Matrix3 m
	         * @param  {qtek.math.Matrix3} m
	         * @return {qtek.math.Vector2}
	         */
	        transformMat3: function(m) {
	            vec2.transformMat3(this._array, this._array, m._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Transform self with a Matrix4 m
	         * @param  {qtek.math.Matrix4} m
	         * @return {qtek.math.Vector2}
	         */
	        transformMat4: function(m) {
	            vec2.transformMat4(this._array, this._array, m._array);
	            this._dirty = true;
	            return this;
	        },

	        toString: function() {
	            return '[' + Array.prototype.join.call(this._array, ',') + ']';
	        },

	        toArray: function () {
	            return Array.prototype.slice.call(this._array);
	        }
	    };

	    // Getter and Setter
	    if (Object.defineProperty) {

	        var proto = Vector2.prototype;
	        /**
	         * @name x
	         * @type {number}
	         * @memberOf qtek.math.Vector2
	         * @instance
	         */
	        Object.defineProperty(proto, 'x', {
	            get: function () {
	                return this._array[0];
	            },
	            set: function (value) {
	                this._array[0] = value;
	                this._dirty = true;
	            }
	        });

	        /**
	         * @name y
	         * @type {number}
	         * @memberOf qtek.math.Vector2
	         * @instance
	         */
	        Object.defineProperty(proto, 'y', {
	            get: function () {
	                return this._array[1];
	            },
	            set: function (value) {
	                this._array[1] = value;
	                this._dirty = true;
	            }
	        });
	    }

	    // Supply methods that are not in place

	    /**
	     * @param  {qtek.math.Vector2} out
	     * @param  {qtek.math.Vector2} a
	     * @param  {qtek.math.Vector2} b
	     * @return {qtek.math.Vector2}
	     */
	    Vector2.add = function(out, a, b) {
	        vec2.add(out._array, a._array, b._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Vector2} out
	     * @param  {number}  x
	     * @param  {number}  y
	     * @return {qtek.math.Vector2}
	     */
	    Vector2.set = function(out, x, y) {
	        vec2.set(out._array, x, y);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Vector2} out
	     * @param  {qtek.math.Vector2} b
	     * @return {qtek.math.Vector2}
	     */
	    Vector2.copy = function(out, b) {
	        vec2.copy(out._array, b._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Vector3} out
	     * @param  {qtek.math.Vector2} a
	     * @param  {qtek.math.Vector2} b
	     * @return {qtek.math.Vector2}
	     */
	    Vector2.cross = function(out, a, b) {
	        vec2.cross(out._array, a._array, b._array);
	        out._dirty = true;
	        return out;
	    };
	    /**
	     * @param  {qtek.math.Vector2} a
	     * @param  {qtek.math.Vector2} b
	     * @return {number}
	     */
	    Vector2.dist = function(a, b) {
	        return vec2.distance(a._array, b._array);
	    };
	    /**
	     * @method
	     * @param  {qtek.math.Vector2} a
	     * @param  {qtek.math.Vector2} b
	     * @return {number}
	     */
	    Vector2.distance = Vector2.dist;
	    /**
	     * @param  {qtek.math.Vector2} out
	     * @param  {qtek.math.Vector2} a
	     * @param  {qtek.math.Vector2} b
	     * @return {qtek.math.Vector2}
	     */
	    Vector2.div = function(out, a, b) {
	        vec2.divide(out._array, a._array, b._array);
	        out._dirty = true;
	        return out;
	    };
	    /**
	     * @method
	     * @param  {qtek.math.Vector2} out
	     * @param  {qtek.math.Vector2} a
	     * @param  {qtek.math.Vector2} b
	     * @return {qtek.math.Vector2}
	     */
	    Vector2.divide = Vector2.div;
	    /**
	     * @param  {qtek.math.Vector2} a
	     * @param  {qtek.math.Vector2} b
	     * @return {number}
	     */
	    Vector2.dot = function(a, b) {
	        return vec2.dot(a._array, b._array);
	    };

	    /**
	     * @param  {qtek.math.Vector2} a
	     * @return {number}
	     */
	    Vector2.len = function(b) {
	        return vec2.length(b._array);
	    };

	    // Vector2.length = Vector2.len;

	    /**
	     * @param  {qtek.math.Vector2} out
	     * @param  {qtek.math.Vector2} a
	     * @param  {qtek.math.Vector2} b
	     * @param  {number}  t
	     * @return {qtek.math.Vector2}
	     */
	    Vector2.lerp = function(out, a, b, t) {
	        vec2.lerp(out._array, a._array, b._array, t);
	        out._dirty = true;
	        return out;
	    };
	    /**
	     * @param  {qtek.math.Vector2} out
	     * @param  {qtek.math.Vector2} a
	     * @param  {qtek.math.Vector2} b
	     * @return {qtek.math.Vector2}
	     */
	    Vector2.min = function(out, a, b) {
	        vec2.min(out._array, a._array, b._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Vector2} out
	     * @param  {qtek.math.Vector2} a
	     * @param  {qtek.math.Vector2} b
	     * @return {qtek.math.Vector2}
	     */
	    Vector2.max = function(out, a, b) {
	        vec2.max(out._array, a._array, b._array);
	        out._dirty = true;
	        return out;
	    };
	    /**
	     * @param  {qtek.math.Vector2} out
	     * @param  {qtek.math.Vector2} a
	     * @param  {qtek.math.Vector2} b
	     * @return {qtek.math.Vector2}
	     */
	    Vector2.mul = function(out, a, b) {
	        vec2.multiply(out._array, a._array, b._array);
	        out._dirty = true;
	        return out;
	    };
	    /**
	     * @method
	     * @param  {qtek.math.Vector2} out
	     * @param  {qtek.math.Vector2} a
	     * @param  {qtek.math.Vector2} b
	     * @return {qtek.math.Vector2}
	     */
	    Vector2.multiply = Vector2.mul;
	    /**
	     * @param  {qtek.math.Vector2} out
	     * @param  {qtek.math.Vector2} a
	     * @return {qtek.math.Vector2}
	     */
	    Vector2.negate = function(out, a) {
	        vec2.negate(out._array, a._array);
	        out._dirty = true;
	        return out;
	    };
	    /**
	     * @param  {qtek.math.Vector2} out
	     * @param  {qtek.math.Vector2} a
	     * @return {qtek.math.Vector2}
	     */
	    Vector2.normalize = function(out, a) {
	        vec2.normalize(out._array, a._array);
	        out._dirty = true;
	        return out;
	    };
	    /**
	     * @param  {qtek.math.Vector2} out
	     * @param  {number}  scale
	     * @return {qtek.math.Vector2}
	     */
	    Vector2.random = function(out, scale) {
	        vec2.random(out._array, scale);
	        out._dirty = true;
	        return out;
	    };
	    /**
	     * @param  {qtek.math.Vector2} out
	     * @param  {qtek.math.Vector2} a
	     * @param  {number}  scale
	     * @return {qtek.math.Vector2}
	     */
	    Vector2.scale = function(out, a, scale) {
	        vec2.scale(out._array, a._array, scale);
	        out._dirty = true;
	        return out;
	    };
	    /**
	     * @param  {qtek.math.Vector2} out
	     * @param  {qtek.math.Vector2} a
	     * @param  {qtek.math.Vector2} b
	     * @param  {number}  scale
	     * @return {qtek.math.Vector2}
	     */
	    Vector2.scaleAndAdd = function(out, a, b, scale) {
	        vec2.scaleAndAdd(out._array, a._array, b._array, scale);
	        out._dirty = true;
	        return out;
	    };
	    /**
	     * @param  {qtek.math.Vector2} a
	     * @param  {qtek.math.Vector2} b
	     * @return {number}
	     */
	    Vector2.sqrDist = function(a, b) {
	        return vec2.sqrDist(a._array, b._array);
	    };
	    /**
	     * @method
	     * @param  {qtek.math.Vector2} a
	     * @param  {qtek.math.Vector2} b
	     * @return {number}
	     */
	    Vector2.squaredDistance = Vector2.sqrDist;

	    /**
	     * @param  {qtek.math.Vector2} a
	     * @return {number}
	     */
	    Vector2.sqrLen = function(a) {
	        return vec2.sqrLen(a._array);
	    };
	    /**
	     * @method
	     * @param  {qtek.math.Vector2} a
	     * @return {number}
	     */
	    Vector2.squaredLength = Vector2.sqrLen;

	    /**
	     * @param  {qtek.math.Vector2} out
	     * @param  {qtek.math.Vector2} a
	     * @param  {qtek.math.Vector2} b
	     * @return {qtek.math.Vector2}
	     */
	    Vector2.sub = function(out, a, b) {
	        vec2.subtract(out._array, a._array, b._array);
	        out._dirty = true;
	        return out;
	    };
	    /**
	     * @method
	     * @param  {qtek.math.Vector2} out
	     * @param  {qtek.math.Vector2} a
	     * @param  {qtek.math.Vector2} b
	     * @return {qtek.math.Vector2}
	     */
	    Vector2.subtract = Vector2.sub;
	    /**
	     * @param  {qtek.math.Vector2} out
	     * @param  {qtek.math.Vector2} a
	     * @param  {qtek.math.Matrix2} m
	     * @return {qtek.math.Vector2}
	     */
	    Vector2.transformMat2 = function(out, a, m) {
	        vec2.transformMat2(out._array, a._array, m._array);
	        out._dirty = true;
	        return out;
	    };
	    /**
	     * @param  {qtek.math.Vector2}  out
	     * @param  {qtek.math.Vector2}  a
	     * @param  {qtek.math.Matrix2d} m
	     * @return {qtek.math.Vector2}
	     */
	    Vector2.transformMat2d = function(out, a, m) {
	        vec2.transformMat2d(out._array, a._array, m._array);
	        out._dirty = true;
	        return out;
	    };
	    /**
	     * @param  {qtek.math.Vector2} out
	     * @param  {qtek.math.Vector2} a
	     * @param  {Matrix3} m
	     * @return {qtek.math.Vector2}
	     */
	    Vector2.transformMat3 = function(out, a, m) {
	        vec2.transformMat3(out._array, a._array, m._array);
	        out._dirty = true;
	        return out;
	    };
	    /**
	     * @param  {qtek.math.Vector2} out
	     * @param  {qtek.math.Vector2} a
	     * @param  {qtek.math.Matrix4} m
	     * @return {qtek.math.Vector2}
	     */
	    Vector2.transformMat4 = function(out, a, m) {
	        vec2.transformMat4(out._array, a._array, m._array);
	        out._dirty = true;
	        return out;
	    };

	    module.exports = Vector2;



/***/ },
/* 23 */
/***/ function(module, exports, __webpack_require__) {

	
	    var uniformVec3Prefix = 'uniform vec3 ';
	    var uniformFloatPrefix = 'uniform float ';
	    var exportHeaderPrefix = '@export qtek.header.';
	    var exportEnd = '@end';
	    var unconfigurable = ':unconfigurable;';
	    module.exports = [
	        exportHeaderPrefix + 'directional_light',
	        uniformVec3Prefix + 'directionalLightDirection[DIRECTIONAL_LIGHT_COUNT]' + unconfigurable,
	        uniformVec3Prefix + 'directionalLightColor[DIRECTIONAL_LIGHT_COUNT]' + unconfigurable,
	        exportEnd,

	        exportHeaderPrefix + 'ambient_light',
	        uniformVec3Prefix + 'ambientLightColor[AMBIENT_LIGHT_COUNT]' + unconfigurable,
	        exportEnd,

	        exportHeaderPrefix + 'ambient_sh_light',
	        uniformVec3Prefix + 'ambientSHLightColor[AMBIENT_SH_LIGHT_COUNT]' + unconfigurable,
	        uniformVec3Prefix + 'ambientSHLightCoefficients[AMBIENT_SH_LIGHT_COUNT * 9]' + unconfigurable,
	        __webpack_require__(24),
	        exportEnd,

	        exportHeaderPrefix + 'ambient_cubemap_light',
	        uniformVec3Prefix + 'ambientCubemapLightColor[AMBIENT_CUBEMAP_LIGHT_COUNT]' + unconfigurable,
	        'uniform samplerCube ambientCubemapLightCubemap[AMBIENT_CUBEMAP_LIGHT_COUNT]' + unconfigurable,
	        'uniform sampler2D ambientCubemapLightBRDFLookup[AMBIENT_CUBEMAP_LIGHT_COUNT]' + unconfigurable,
	        exportEnd,

	        exportHeaderPrefix + 'point_light',
	        uniformVec3Prefix + 'pointLightPosition[POINT_LIGHT_COUNT]' + unconfigurable,
	        uniformFloatPrefix + 'pointLightRange[POINT_LIGHT_COUNT]' + unconfigurable,
	        uniformVec3Prefix + 'pointLightColor[POINT_LIGHT_COUNT]' + unconfigurable,
	        exportEnd,

	        exportHeaderPrefix + 'spot_light',
	        uniformVec3Prefix + 'spotLightPosition[SPOT_LIGHT_COUNT]' + unconfigurable,
	        uniformVec3Prefix + 'spotLightDirection[SPOT_LIGHT_COUNT]' + unconfigurable,
	        uniformFloatPrefix + 'spotLightRange[SPOT_LIGHT_COUNT]' + unconfigurable,
	        uniformFloatPrefix + 'spotLightUmbraAngleCosine[SPOT_LIGHT_COUNT]' + unconfigurable,
	        uniformFloatPrefix + 'spotLightPenumbraAngleCosine[SPOT_LIGHT_COUNT]' + unconfigurable,
	        uniformFloatPrefix + 'spotLightFalloffFactor[SPOT_LIGHT_COUNT]' + unconfigurable,
	        uniformVec3Prefix + 'spotLightColor[SPOT_LIGHT_COUNT]' + unconfigurable,
	        exportEnd
	    ].join('\n');


/***/ },
/* 24 */
/***/ function(module, exports) {

	
	module.exports = "vec3 calcAmbientSHLight(int idx, vec3 N) {\n    int offset = 9 * idx;\n\n    // FIXME Index expression must be constant\n    return ambientSHLightCoefficients[0]\n        + ambientSHLightCoefficients[1] * N.x\n        + ambientSHLightCoefficients[2] * N.y\n        + ambientSHLightCoefficients[3] * N.z\n        + ambientSHLightCoefficients[4] * N.x * N.z\n        + ambientSHLightCoefficients[5] * N.z * N.y\n        + ambientSHLightCoefficients[6] * N.y * N.x\n        + ambientSHLightCoefficients[7] * (3.0 * N.z * N.z - 1.0)\n        + ambientSHLightCoefficients[8] * (N.x * N.x - N.y * N.y);\n}";


/***/ },
/* 25 */
/***/ function(module, exports, __webpack_require__) {

	

	    var Base = __webpack_require__(6);
	    var Ray = __webpack_require__(26);
	    var Vector2 = __webpack_require__(22);
	    var Vector3 = __webpack_require__(14);
	    var Matrix4 = __webpack_require__(16);
	    var Renderable = __webpack_require__(27);
	    var StaticGeometry = __webpack_require__(32);
	    var glenum = __webpack_require__(11);

	    /**
	     * @constructor qtek.picking.RayPicking
	     * @extends qtek.core.Base
	     */
	    var RayPicking = Base.extend(
	    /** @lends qtek.picking.RayPicking# */
	    {
	        /**
	         * Target scene
	         * @type {qtek.Scene}
	         */
	        scene: null,
	        /**
	         * Target camera
	         * @type {qtek.Camera}
	         */
	        camera: null,
	        /**
	         * Target renderer
	         * @type {qtek.Renderer}
	         */
	        renderer: null
	    }, function() {
	        this._ray = new Ray();
	        this._ndc = new Vector2();
	    },
	    /** @lends qtek.picking.RayPicking.prototype */
	    {

	        /**
	         * Pick the nearest intersection object in the scene
	         * @param  {number} x Mouse position x
	         * @param  {number} y Mouse position y
	         * @return {qtek.picking.RayPicking~Intersection}
	         */
	        pick: function (x, y) {
	            var out = this.pickAll(x, y);
	            return out[0] || null;
	        },

	        /**
	         * Pick all intersection objects, wich will be sorted from near to far
	         * @param  {number} x Mouse position x
	         * @param  {number} y Mouse position y
	         * @param  {Array} [output]
	         * @return {Array.<qtek.picking.RayPicking~Intersection>}
	         */
	        pickAll: function (x, y, output) {
	            this.renderer.screenToNdc(x, y, this._ndc);
	            this.camera.castRay(this._ndc, this._ray);

	            output = output || [];

	            this._intersectNode(this.scene, output);

	            output.sort(this._intersectionCompareFunc);

	            return output;
	        },

	        _intersectNode: function (node, out) {
	            if ((node instanceof Renderable) && node.isRenderable()) {
	                if (!node.ignorePicking && node.geometry.isUseFace()) {
	                    this._intersectRenderable(node, out);
	                }
	            }
	            for (var i = 0; i < node._children.length; i++) {
	                this._intersectNode(node._children[i], out);
	            }
	        },

	        _intersectRenderable: (function () {

	            var v1 = new Vector3();
	            var v2 = new Vector3();
	            var v3 = new Vector3();
	            var ray = new Ray();
	            var worldInverse = new Matrix4();

	            return function (renderable, out) {

	                ray.copy(this._ray);
	                Matrix4.invert(worldInverse, renderable.worldTransform);

	                ray.applyTransform(worldInverse);

	                var geometry = renderable.geometry;
	                if (geometry.boundingBox) {
	                    if (!ray.intersectBoundingBox(geometry.boundingBox)) {
	                        return;
	                    }
	                }
	                // Use user defined ray picking algorithm
	                if (geometry.pickByRay) {
	                    var intersection = geometry.pickByRay(ray);
	                    if (intersection) {
	                        out.push(intersection);
	                    }
	                    return;
	                }

	                var isStatic = geometry instanceof StaticGeometry;
	                var cullBack = (renderable.cullFace === glenum.BACK && renderable.frontFace === glenum.CCW)
	                            || (renderable.cullFace === glenum.FRONT && renderable.frontFace === glenum.CW);

	                var point;
	                if (isStatic) {
	                    var faces = geometry.faces;
	                    var positions = geometry.attributes.position.value;
	                    for (var i = 0; i < faces.length;) {
	                        var i1 = faces[i++] * 3;
	                        var i2 = faces[i++] * 3;
	                        var i3 = faces[i++] * 3;

	                        v1._array[0] = positions[i1];
	                        v1._array[1] = positions[i1 + 1];
	                        v1._array[2] = positions[i1 + 2];

	                        v2._array[0] = positions[i2];
	                        v2._array[1] = positions[i2 + 1];
	                        v2._array[2] = positions[i2 + 2];

	                        v3._array[0] = positions[i3];
	                        v3._array[1] = positions[i3 + 1];
	                        v3._array[2] = positions[i3 + 2];

	                        if (cullBack) {
	                            point = ray.intersectTriangle(v1, v2, v3, renderable.culling);
	                        } else {
	                            point = ray.intersectTriangle(v1, v3, v2, renderable.culling);
	                        }
	                        if (point) {
	                            var pointW = new Vector3();
	                            Vector3.transformMat4(pointW, point, renderable.worldTransform);
	                            out.push(new RayPicking.Intersection(
	                                point, pointW, renderable, [i1 / 3, i2 / 3, i3 / 3],
	                                Vector3.dist(pointW, this._ray.origin)
	                            ));
	                        }
	                    }
	                } else {
	                    var faces = geometry.faces;
	                    var positions = geometry.attributes.position.value;
	                    for (var i = 0; i < faces.length; i++) {
	                        var face = faces[i];
	                        var i1 = face[0];
	                        var i2 = face[1];
	                        var i3 = face[2];

	                        v1.setArray(positions[i1]);
	                        v2.setArray(positions[i2]);
	                        v3.setArray(positions[i3]);

	                        if (cullBack) {
	                            point = ray.intersectTriangle(v1, v2, v3, renderable.culling);
	                        } else {
	                            point = ray.intersectTriangle(v1, v3, v2, renderable.culling);
	                        }
	                        if (point) {
	                            var pointW = new Vector3();
	                            Vector3.transformMat4(pointW, point, renderable.worldTransform);
	                            out.push(new RayPicking.Intersection(
	                                point, pointW, renderable, [i1, i2, i3],
	                                Vector3.dist(pointW, this._ray.origin)
	                            ));
	                        }
	                    }
	                }
	            };
	        })(),

	        _intersectionCompareFunc: function (a, b) {
	            return a.distance - b.distance;
	        }
	    });

	    /**
	     * @constructor qtek.picking.RayPicking~Intersection
	     * @param {qtek.math.Vector3} point
	     * @param {qtek.math.Vector3} pointWorld
	     * @param {qtek.Node} target
	     * @param {Array.<number>} face
	     * @param {number} distance
	     */
	    RayPicking.Intersection = function (point, pointWorld, target, face, distance) {
	        /**
	         * Intersection point in local transform coordinates
	         * @type {qtek.math.Vector3}
	         */
	        this.point = point;
	        /**
	         * Intersection point in world transform coordinates
	         * @type {qtek.math.Vector3}
	         */
	        this.pointWorld = pointWorld;
	        /**
	         * Intersection scene node
	         * @type {qtek.Node}
	         */
	        this.target = target;
	        /**
	         * Intersection triangle, which is an array of vertex index
	         * @type {Array.<number>}
	         */
	        this.face = face;
	        /**
	         * Distance from intersection point to ray origin
	         * @type {number}
	         */
	        this.distance = distance;
	    };

	    module.exports = RayPicking;


/***/ },
/* 26 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';


	    var Vector3 = __webpack_require__(14);
	    var glMatrix = __webpack_require__(15);
	    var vec3 = glMatrix.vec3;
	    
	    var EPSILON = 1e-5;

	    /**
	     * @constructor
	     * @alias qtek.math.Ray
	     * @param {qtek.math.Vector3} [origin]
	     * @param {qtek.math.Vector3} [direction]
	     */
	    var Ray = function(origin, direction) {
	        /**
	         * @type {qtek.math.Vector3}
	         */
	        this.origin = origin || new Vector3();
	        /**
	         * @type {qtek.math.Vector3}
	         */
	        this.direction = direction || new Vector3();
	    };

	    Ray.prototype = {
	        
	        constructor: Ray,

	        // http://www.siggraph.org/education/materials/HyperGraph/raytrace/rayplane_intersection.htm
	        /**
	         * Calculate intersection point between ray and a give plane
	         * @param  {qtek.math.Plane} plane
	         * @param  {qtek.math.Vector3} [out]
	         * @return {qtek.math.Vector3}
	         */
	        intersectPlane: function(plane, out) {
	            var pn = plane.normal._array;
	            var d = plane.distance;
	            var ro = this.origin._array;
	            var rd = this.direction._array;

	            var divider = vec3.dot(pn, rd);
	            // ray is parallel to the plane
	            if (divider === 0) {
	                return null;
	            }
	            if (!out) {
	                out = new Vector3();
	            }
	            var t = (vec3.dot(pn, ro) - d) / divider;
	            vec3.scaleAndAdd(out._array, ro, rd, -t);
	            out._dirty = true;
	            return out;
	        },

	        /**
	         * Mirror the ray against plane
	         * @param  {qtek.math.Plane} plane
	         */
	        mirrorAgainstPlane: function(plane) {
	            // Distance to plane
	            var d = vec3.dot(plane.normal._array, this.direction._array);
	            vec3.scaleAndAdd(this.direction._array, this.direction._array, plane.normal._array, -d * 2);
	            this.direction._dirty = true;
	        },

	        distanceToPoint: (function () {
	            var v = vec3.create();
	            return function (point) {
	                vec3.sub(v, point, this.origin._array);
	                // Distance from projection point to origin
	                var b = vec3.dot(v, this.direction._array);
	                if (b < 0) {
	                    return vec3.distance(this.origin._array, point);
	                }
	                // Squared distance from center to origin
	                var c2 = vec3.lenSquared(v);
	                // Squared distance from center to projection point
	                return Math.sqrt(c2 - b * b);
	            };
	        })(),

	        /**
	         * Calculate intersection point between ray and sphere
	         * @param  {qtek.math.Vector3} center
	         * @param  {number} radius
	         * @param  {qtek.math.Vector3} out
	         * @return {qtek.math.Vector3}
	         */
	        intersectSphere: (function () {
	            var v = vec3.create();
	            return function (center, radius, out) {
	                var origin = this.origin._array;
	                var direction = this.direction._array;
	                center = center._array;
	                vec3.sub(v, center, origin);
	                // Distance from projection point to origin
	                var b = vec3.dot(v, direction);
	                // Squared distance from center to origin
	                var c2 = vec3.squaredLength(v);
	                // Squared distance from center to projection point
	                var d2 = c2 - b * b;

	                var r2 = radius * radius;
	                // No intersection
	                if (d2 > r2) {
	                    return;
	                }

	                var a = Math.sqrt(r2 - d2);
	                // First intersect point
	                var t0 = b - a;
	                // Second intersect point
	                var t1 = b + a;

	                if (!out) {
	                    out = new Vector3();
	                }
	                if (t0 < 0) {
	                    if (t1 < 0) {
	                        return null;
	                    } else {
	                        vec3.scaleAndAdd(out._array, origin, direction, t1);
	                        return out;
	                    }
	                } else {
	                    vec3.scaleAndAdd(out._array, origin, direction, t0);
	                    return out;
	                }
	            };
	        })(),

	        // http://www.scratchapixel.com/lessons/3d-basic-lessons/lesson-7-intersecting-simple-shapes/ray-box-intersection/
	        /**
	         * Calculate intersection point between ray and bounding box
	         * @param {qtek.math.BoundingBox} bbox
	         * @param {qtek.math.Vector3}
	         * @return {qtek.math.Vector3}
	         */
	        intersectBoundingBox: function(bbox, out) {
	            var dir = this.direction._array;
	            var origin = this.origin._array;
	            var min = bbox.min._array;
	            var max = bbox.max._array;

	            var invdirx = 1 / dir[0];
	            var invdiry = 1 / dir[1];
	            var invdirz = 1 / dir[2];

	            var tmin, tmax, tymin, tymax, tzmin, tzmax;
	            if (invdirx >= 0) {
	                tmin = (min[0] - origin[0]) * invdirx;
	                tmax = (max[0] - origin[0]) * invdirx;
	            } else {
	                tmax = (min[0] - origin[0]) * invdirx;
	                tmin = (max[0] - origin[0]) * invdirx;
	            }
	            if (invdiry >= 0) {
	                tymin = (min[1] - origin[1]) * invdiry;
	                tymax = (max[1] - origin[1]) * invdiry;
	            } else {
	                tymax = (min[1] - origin[1]) * invdiry;
	                tymin = (max[1] - origin[1]) * invdiry;
	            }

	            if ((tmin > tymax) || (tymin > tmax)) {
	                return null;
	            }

	            if (tymin > tmin || tmin !== tmin) {
	                tmin = tymin;
	            }
	            if (tymax < tmax || tmax !== tmax) {
	                tmax = tymax;
	            }

	            if (invdirz >= 0) {
	                tzmin = (min[2] - origin[2]) * invdirz;
	                tzmax = (max[2] - origin[2]) * invdirz;
	            } else {
	                tzmax = (min[2] - origin[2]) * invdirz;
	                tzmin = (max[2] - origin[2]) * invdirz;
	            }

	            if ((tmin > tzmax) || (tzmin > tmax)) {
	                return null;
	            }

	            if (tzmin > tmin || tmin !== tmin) {
	                tmin = tzmin;
	            }
	            if (tzmax < tmax || tmax !== tmax) {
	                tmax = tzmax;
	            }
	            if (tmax < 0) {
	                return null;
	            }

	            var t = tmin >= 0 ? tmin : tmax;

	            if (!out) {
	                out = new Vector3();
	            }
	            vec3.scaleAndAdd(out._array, origin, dir, t);
	            return out;
	        },

	        // http://en.wikipedia.org/wiki/M%C3%B6ller%E2%80%93Trumbore_intersection_algorithm
	        /**
	         * Calculate intersection point between ray and three triangle vertices
	         * @param {qtek.math.Vector3} a
	         * @param {qtek.math.Vector3} b
	         * @param {qtek.math.Vector3} c
	         * @param {boolean}           singleSided, CW triangle will be ignored
	         * @param {qtek.math.Vector3} [out]
	         * @param {qtek.math.Vector3} [barycenteric] barycentric coords
	         * @return {qtek.math.Vector3}
	         */
	        intersectTriangle: (function() {
	            
	            var eBA = vec3.create();
	            var eCA = vec3.create();
	            var AO = vec3.create();
	            var vCross = vec3.create();

	            return function(a, b, c, singleSided, out, barycenteric) {
	                var dir = this.direction._array;
	                var origin = this.origin._array;
	                a = a._array;
	                b = b._array;
	                c = c._array;

	                vec3.sub(eBA, b, a);
	                vec3.sub(eCA, c, a);

	                vec3.cross(vCross, eCA, dir);

	                var det = vec3.dot(eBA, vCross);

	                if (singleSided) {
	                    if (det > -EPSILON) {
	                        return null;
	                    }
	                }
	                else {
	                    if (det > -EPSILON && det < EPSILON) {
	                        return null;
	                    }
	                }

	                vec3.sub(AO, origin, a);
	                var u = vec3.dot(vCross, AO) / det;
	                if (u < 0 || u > 1) {
	                    return null;
	                }

	                vec3.cross(vCross, eBA, AO);
	                var v = vec3.dot(dir, vCross) / det;

	                if (v < 0 || v > 1 || (u + v > 1)) {
	                    return null;
	                }

	                vec3.cross(vCross, eBA, eCA);
	                var t = -vec3.dot(AO, vCross) / det;

	                if (t < 0) {
	                    return null;
	                }

	                if (!out) {
	                    out = new Vector3();
	                }
	                if (barycenteric) {
	                    Vector3.set(barycenteric, (1 - u - v), u, v);
	                }
	                vec3.scaleAndAdd(out._array, origin, dir, t);

	                return out;
	            };
	        })(),

	        /**
	         * Apply an affine transform matrix to the ray
	         * @return {qtek.math.Matrix4} matrix
	         */
	        applyTransform: function(matrix) {
	            Vector3.add(this.direction, this.direction, this.origin);
	            Vector3.transformMat4(this.origin, this.origin, matrix);
	            Vector3.transformMat4(this.direction, this.direction, matrix);

	            Vector3.sub(this.direction, this.direction, this.origin);
	            Vector3.normalize(this.direction, this.direction);
	        },

	        /**
	         * Copy values from another ray
	         * @param {qtek.math.Ray} ray
	         */
	        copy: function(ray) {
	            Vector3.copy(this.origin, ray.origin);
	            Vector3.copy(this.direction, ray.direction);
	        },

	        /**
	         * Clone a new ray
	         * @return {qtek.math.Ray}
	         */
	        clone: function() {
	            var ray = new Ray();
	            ray.copy(this);
	            return ray;
	        }
	    };

	    module.exports = Ray;


/***/ },
/* 27 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';


	    var Node = __webpack_require__(28);
	    var glenum = __webpack_require__(11);
	    var glinfo = __webpack_require__(10);
	    var DynamicGeometry = __webpack_require__(30);

	    // Cache
	    var prevDrawID = 0;
	    var prevDrawIndicesBuffer = null;
	    var prevDrawIsUseFace = true;

	    var currentDrawID;

	    var RenderInfo = function() {
	        this.faceCount = 0;
	        this.vertexCount = 0;
	        this.drawCallCount = 0;
	    };

	    function VertexArrayObject(
	        availableAttributes,
	        availableAttributeSymbols,
	        indicesBuffer
	    ) {
	        this.availableAttributes = availableAttributes;
	        this.availableAttributeSymbols = availableAttributeSymbols;
	        this.indicesBuffer = indicesBuffer;

	        this.vao = null;
	    }
	    /**
	     * @constructor qtek.Renderable
	     * @extends qtek.Node
	     */
	    var Renderable = Node.extend(
	    /** @lends qtek.Renderable# */
	    {
	        /**
	         * @type {qtek.Material}
	         */
	        material: null,

	        /**
	         * @type {qtek.Geometry}
	         */
	        geometry: null,

	        /**
	         * @type {number}
	         */
	        mode: glenum.TRIANGLES,

	        _drawCache: null,

	        _renderInfo: null
	    }, function() {
	        this._drawCache = {};
	        this._renderInfo = new RenderInfo();
	    },
	    /** @lends qtek.Renderable.prototype */
	    {

	        /**
	         * Render order
	         * @type {Number}
	         */
	        renderOrder: 0,
	        /**
	         * Used when mode is LINES, LINE_STRIP or LINE_LOOP
	         * @type {number}
	         */
	        lineWidth: 1,

	        /**
	         * @type {boolean}
	         */
	        culling: true,
	        /**
	         * @type {number}
	         */
	        cullFace: glenum.BACK,
	        /**
	         * @type {number}
	         */
	        frontFace: glenum.CCW,

	        /**
	         * Software frustum culling
	         * @type {boolean}
	         */
	        frustumCulling: true,
	        /**
	         * @type {boolean}
	         */
	        receiveShadow: true,
	        /**
	         * @type {boolean}
	         */
	        castShadow: true,
	        /**
	         * @type {boolean}
	         */
	        ignorePicking: false,

	        /**
	         * @return {boolean}
	         */
	        isRenderable: function() {
	            return this.geometry && this.material && !this.invisible
	                && this.geometry.vertexCount > 0;
	        },

	        /**
	         * Before render hook
	         * @type {Function}
	         * @memberOf qtek.Renderable
	         */
	        beforeRender: function (_gl) {},

	        /**
	         * Before render hook
	         * @type {Function}
	         * @memberOf qtek.Renderable
	         */
	        afterRender: function (_gl, renderStat) {},

	        getBoundingBox: function (filter, out) {
	            out = Node.prototype.getBoundingBox.call(this, filter, out);
	            if (this.geometry && this.geometry.boundingBox) {
	                out.union(this.geometry.boundingBox);
	            }

	            return out;
	        },

	        /**
	         * @param  {WebGLRenderingContext} _gl
	         * @param  {qtek.Material} [globalMaterial]
	         * @return {Object}
	         */
	        render: function (_gl, globalMaterial) {
	            var material = globalMaterial || this.material;
	            var shader = material.shader;
	            var geometry = this.geometry;

	            var glDrawMode = this.mode;

	            var nVertex = geometry.vertexCount;
	            var isUseFace = geometry.isUseFace();

	            var uintExt = glinfo.getExtension(_gl, 'OES_element_index_uint');
	            var useUintExt = uintExt && nVertex > 0xffff;
	            var indicesType = useUintExt ? _gl.UNSIGNED_INT : _gl.UNSIGNED_SHORT;

	            var vaoExt = glinfo.getExtension(_gl, 'OES_vertex_array_object');

	            var isStatic = !geometry.dynamic;

	            var renderInfo = this._renderInfo;
	            renderInfo.vertexCount = nVertex;
	            renderInfo.faceCount = 0;
	            renderInfo.drawCallCount = 0;
	            // Draw each chunk
	            var drawHashChanged = false;
	            // Hash with shader id in case previous material has less attributes than next material
	            currentDrawID = _gl.__GLID__ + '-' + geometry.__GUID__ + '-' + shader.__GUID__;

	            if (currentDrawID !== prevDrawID) {
	                drawHashChanged = true;
	            }
	            else {
	                // The cache will be invalid in the following cases
	                // 1. Geometry is splitted to multiple chunks
	                // 2. VAO is enabled and is binded to null after render
	                // 3. Geometry needs update
	                if (
	                    ((geometry instanceof DynamicGeometry) && (nVertex > 0xffff && !uintExt) && isUseFace)
	                 || (vaoExt && isStatic)
	                 || geometry._cache.isDirty()
	                ) {
	                    drawHashChanged = true;
	                }
	            }
	            prevDrawID = currentDrawID;

	            if (!drawHashChanged) {
	                // Direct draw
	                if (prevDrawIsUseFace) {
	                    _gl.drawElements(glDrawMode, prevDrawIndicesBuffer.count, indicesType, 0);
	                    renderInfo.faceCount = prevDrawIndicesBuffer.count / 3;
	                }
	                else {
	                    // FIXME Use vertex number in buffer
	                    // vertexCount may get the wrong value when geometry forget to mark dirty after update
	                    _gl.drawArrays(glDrawMode, 0, nVertex);
	                }
	                renderInfo.drawCallCount = 1;
	            }
	            else {
	                // Use the cache of static geometry
	                var vaoList = this._drawCache[currentDrawID];
	                if (!vaoList) {
	                    var chunks = geometry.getBufferChunks(_gl);
	                    if (!chunks) {  // Empty mesh
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
	                            }
	                            else {
	                                symbol = name;
	                            }
	                            if (symbol && shader.attributeTemplates[symbol]) {
	                                availableAttributes.push(attributeBufferInfo);
	                                availableAttributeSymbols.push(symbol);
	                            }
	                        }

	                        var vao = new VertexArrayObject(
	                            availableAttributes,
	                            availableAttributeSymbols,
	                            indicesBuffer
	                        );
	                        vaoList.push(vao);
	                    }
	                    if (isStatic) {
	                        this._drawCache[currentDrawID] = vaoList;
	                    }
	                }

	                for (var i = 0; i < vaoList.length; i++) {
	                    var vao = vaoList[i];
	                    var needsBindAttributes = true;

	                    // Create vertex object array cost a lot
	                    // So we don't use it on the dynamic object
	                    if (vaoExt && isStatic) {
	                        // Use vertex array object
	                        // http://blog.tojicode.com/2012/10/oesvertexarrayobject-extension.html
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
	                        var locationList = shader.enableAttributes(_gl, vao.availableAttributeSymbols, (vaoExt && isStatic && vao.vao));
	                        // Setting attributes;
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
	                    if (
	                        glDrawMode == glenum.LINES ||
	                        glDrawMode == glenum.LINE_STRIP ||
	                        glDrawMode == glenum.LINE_LOOP
	                    ) {
	                        _gl.lineWidth(this.lineWidth);
	                    }

	                    prevDrawIndicesBuffer = indicesBuffer;
	                    prevDrawIsUseFace = geometry.isUseFace();
	                    // Do drawing
	                    if (prevDrawIsUseFace) {
	                        if (needsBindAttributes) {
	                            _gl.bindBuffer(_gl.ELEMENT_ARRAY_BUFFER, indicesBuffer.buffer);
	                        }
	                        _gl.drawElements(glDrawMode, indicesBuffer.count, indicesType, 0);
	                        renderInfo.faceCount += indicesBuffer.count / 3;
	                    } else {
	                        _gl.drawArrays(glDrawMode, 0, nVertex);
	                    }

	                    if (vaoExt && isStatic) {
	                        vaoExt.bindVertexArrayOES(null);
	                    }

	                    renderInfo.drawCallCount++;
	                }
	            }

	            return renderInfo;
	        },

	        /**
	         * Clone a new renderable
	         * @method
	         * @return {qtek.Renderable}
	         */
	        clone: (function() {
	            var properties = [
	                'castShadow', 'receiveShadow',
	                'mode', 'culling', 'cullFace', 'frontFace',
	                'frustumCulling'
	            ];
	            return function() {
	                var renderable = Node.prototype.clone.call(this);

	                renderable.geometry = this.geometry;
	                renderable.material = this.material;

	                for (var i = 0; i < properties.length; i++) {
	                    var name = properties[i];
	                    // Try not to overwrite the prototype property
	                    if (renderable[name] !== this[name]) {
	                        renderable[name] = this[name];
	                    }
	                }

	                return renderable;
	            };
	        })()
	    });

	    Renderable.beforeFrame = function() {
	        prevDrawID = 0;
	    };

	    // Enums
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

	    module.exports = Renderable;


/***/ },
/* 28 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';


	    var Base = __webpack_require__(6);
	    var Vector3 = __webpack_require__(14);
	    var Quaternion = __webpack_require__(29);
	    var Matrix4 = __webpack_require__(16);
	    var glMatrix = __webpack_require__(15);
	    var BoundingBox = __webpack_require__(13);
	    var mat4 = glMatrix.mat4;

	    var nameId = 0;

	    /**
	     * @constructor qtek.Node
	     * @extends qtek.core.Base
	     */
	    var Node = Base.extend(
	    /** @lends qtek.Node# */
	    {
	        /**
	         * Scene node name
	         * @type {string}
	         */
	        name: '',

	        /**
	         * Position relative to its parent node. aka translation.
	         * @type {qtek.math.Vector3}
	         */
	        position: null,

	        /**
	         * Rotation relative to its parent node. Represented by a quaternion
	         * @type {qtek.math.Quaternion}
	         */
	        rotation: null,

	        /**
	         * Scale relative to its parent node
	         * @type {qtek.math.Vector3}
	         */
	        scale: null,

	        /**
	         * Affine transform matrix relative to its root scene.
	         * @type {qtek.math.Matrix4}
	         */
	        worldTransform: null,

	        /**
	         * Affine transform matrix relative to its parent node.
	         * Composited with position, rotation and scale.
	         * @type {qtek.math.Matrix4}
	         */
	        localTransform: null,

	        /**
	         * If the local transform is update from SRT(scale, rotation, translation, which is position here) each frame
	         * @type {boolean}
	         */
	        autoUpdateLocalTransform: true,

	        /**
	         * Parent of current scene node
	         * @type {?qtek.Node}
	         * @private
	         */
	        _parent: null,
	        /**
	         * The root scene mounted. Null if it is a isolated node
	         * @type {?qtek.Scene}
	         * @private
	         */
	        _scene: null,

	        _needsUpdateWorldTransform: true,

	        _inIterating: false,

	        // Depth for transparent queue sorting
	        __depth: 0

	    }, function () {

	        if (!this.name) {
	            this.name = (this.type || 'NODE') + '_' + (nameId++);
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

	    },
	    /**@lends qtek.Node.prototype. */
	    {

	        /**
	         * If node and its chilren invisible
	         * @type {boolean}
	         * @memberOf qtek.Node
	         * @instance
	         */
	        invisible: false,

	        /**
	         * Return true if it is a renderable scene node, like Mesh and ParticleSystem
	         * @return {boolean}
	         */
	        isRenderable: function () {
	            return false;
	        },

	        /**
	         * Set the name of the scene node
	         * @param {string} name
	         */
	        setName: function (name) {
	            var scene = this._scene;
	            if (scene) {
	                var nodeRepository = scene._nodeRepository;
	                delete nodeRepository[this.name];
	                nodeRepository[name] = this;
	            }
	            this.name = name;
	        },

	        /**
	         * Add a child node
	         * @param {qtek.Node} node
	         */
	        add: function (node) {
	            if (this._inIterating) {
	                console.warn('Add operation can cause unpredictable error when in iterating');
	            }
	            var originalParent = node._parent;
	            if (originalParent === this) {
	                return;
	            }
	            if (originalParent) {
	                originalParent.remove(node);
	            }
	            node._parent = this;
	            this._children.push(node);

	            var scene = this._scene;
	            if (scene && scene !== node.scene) {
	                node.traverse(this._addSelfToScene, this);
	            }
	            // Mark children needs update transform
	            // In case child are remove and added again after parent moved
	            node._needsUpdateWorldTransform = true;
	        },

	        /**
	         * Remove the given child scene node
	         * @param {qtek.Node} node
	         */
	        remove: function (node) {
	            if (this._inIterating) {
	                console.warn('Remove operation can cause unpredictable error when in iterating');
	            }
	            var children = this._children;
	            var idx = children.indexOf(node);
	            if (idx < 0) {
	                return;
	            }

	            children.splice(idx, 1);
	            node._parent = null;

	            if (this._scene) {
	                node.traverse(this._removeSelfFromScene, this);
	            }
	        },

	        /**
	         * Remove all children
	         */
	        removeAll: function () {
	            var children = this._children;

	            for (var idx = 0; idx < children.length; idx++) {
	                children[idx]._parent = null;

	                if (this._scene) {
	                    children[idx].traverse(this._removeSelfFromScene, this);
	                }
	            }

	            this._children = [];
	        },

	        /**
	         * Get the scene mounted
	         * @return {qtek.Scene}
	         */
	        getScene: function () {
	            return this._scene;
	        },

	        /**
	         * Get parent node
	         * @return {qtek.Scene}
	         */
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

	        /**
	         * Return true if it is ancestor of the given scene node
	         * @param {qtek.Node} node
	         */
	        isAncestor: function (node) {
	            var parent = node._parent;
	            while(parent) {
	                if (parent === this) {
	                    return true;
	                }
	                parent = parent._parent;
	            }
	            return false;
	        },

	        /**
	         * Get a new created array of all its children nodes
	         * @return {qtek.Node[]}
	         */
	        children: function () {
	            return this._children.slice();
	        },

	        childAt: function (idx) {
	            return this._children[idx];
	        },

	        /**
	         * Get first child with the given name
	         * @param {string} name
	         * @return {qtek.Node}
	         */
	        getChildByName: function (name) {
	            var children = this._children;
	            for (var i = 0; i < children.length; i++) {
	                if (children[i].name === name) {
	                    return children[i];
	                }
	            }
	        },

	        /**
	         * Get first descendant have the given name
	         * @param {string} name
	         * @return {qtek.Node}
	         */
	        getDescendantByName: function (name) {
	            var children = this._children;
	            for (var i = 0; i < children.length; i++) {
	                var child = children[i];
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

	        /**
	         * Query descendant node by path
	         * @param {string} path
	         * @return {qtek.Node}
	         */
	        queryNode: function (path) {
	            if (!path) {
	                return;
	            }
	            // TODO Name have slash ?
	            var pathArr = path.split('/');
	            var current = this;
	            for (var i = 0; i < pathArr.length; i++) {
	                var name = pathArr[i];
	                // Skip empty
	                if (!name) {
	                    continue;
	                }
	                var found = false;
	                var children = current._children;
	                for (var j = 0; j < children.length; j++) {
	                    var child = children[j];
	                    if (child.name === name) {
	                        current = child;
	                        found = true;
	                        break;
	                    }
	                }
	                // Early return if not found
	                if (!found) {
	                    return;
	                }
	            }

	            return current;
	        },

	        /**
	         * Get query path, relative to rootNode(default is scene)
	         * @return {string}
	         */
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

	        /**
	         * Depth first traverse all its descendant scene nodes and
	         * @param {Function} callback
	         * @param {Node} [context]
	         * @param {Function} [ctor]
	         */
	        traverse: function (callback, context, ctor) {

	            this._inIterating = true;

	            if (ctor == null || this.constructor === ctor) {
	                callback.call(context, this);
	            }
	            var _children = this._children;
	            for(var i = 0, len = _children.length; i < len; i++) {
	                _children[i].traverse(callback, context, ctor);
	            }

	            this._inIterating = false;
	        },

	        eachChild: function (callback, context, ctor) {
	            this._inIterating = true;

	            var _children = this._children;
	            var noCtor = ctor == null;
	            for(var i = 0, len = _children.length; i < len; i++) {
	                var child = _children[i];
	                if (noCtor || child.constructor === ctor) {
	                    callback.call(context, child, i);
	                }
	            }

	            this._inIterating = false;
	        },

	        /**
	         * Set the local transform and decompose to SRT
	         * @param {qtek.math.Matrix4} matrix
	         */
	        setLocalTransform: function (matrix) {
	            mat4.copy(this.localTransform._array, matrix._array);
	            this.decomposeLocalTransform();
	        },

	        /**
	         * Decompose the local transform to SRT
	         */
	        decomposeLocalTransform: function (keepScale) {
	            var scale = !keepScale ? this.scale: null;
	            this.localTransform.decomposeMatrix(scale, this.rotation, this.position);
	        },

	        /**
	         * Set the world transform and decompose to SRT
	         * @param {qtek.math.Matrix4} matrix
	         */
	        setWorldTransform: function (matrix) {
	            mat4.copy(this.worldTransform._array, matrix._array);
	            this.decomposeWorldTransform();
	        },

	        /**
	         * Decompose the world transform to SRT
	         * @method
	         */
	        decomposeWorldTransform: (function () {

	            var tmp = mat4.create();

	            return function (keepScale) {
	                var localTransform = this.localTransform;
	                var worldTransform = this.worldTransform;
	                // Assume world transform is updated
	                if (this._parent) {
	                    mat4.invert(tmp, this._parent.worldTransform._array);
	                    mat4.multiply(localTransform._array, tmp, worldTransform._array);
	                } else {
	                    mat4.copy(localTransform._array, worldTransform._array);
	                }
	                var scale = !keepScale ? this.scale: null;
	                localTransform.decomposeMatrix(scale, this.rotation, this.position);
	            };
	        })(),

	        transformNeedsUpdate: function () {
	            return this.position._dirty
	                || this.rotation._dirty
	                || this.scale._dirty;
	        },

	        /**
	         * Update local transform from SRT
	         * Notice that local transform will not be updated if _dirty mark of position, rotation, scale is all false
	         */
	        updateLocalTransform: function () {
	            var position = this.position;
	            var rotation = this.rotation;
	            var scale = this.scale;

	            if (this.transformNeedsUpdate()) {
	                var m = this.localTransform._array;

	                // Transform order, scale->rotation->position
	                mat4.fromRotationTranslation(m, rotation._array, position._array);

	                mat4.scale(m, m, scale._array);

	                rotation._dirty = false;
	                scale._dirty = false;
	                position._dirty = false;

	                this._needsUpdateWorldTransform = true;
	            }
	        },

	        /**
	         * Update world transform, assume its parent world transform have been updated
	         */
	        updateWorldTransform: function () {
	            var localTransform = this.localTransform._array;
	            var worldTransform = this.worldTransform._array;
	            if (this._parent) {
	                mat4.multiplyAffine(
	                    worldTransform,
	                    this._parent.worldTransform._array,
	                    localTransform
	                );
	            }
	            else {
	                mat4.copy(worldTransform, localTransform);
	            }
	        },

	        /**
	         * Update local transform and world transform recursively
	         * @param {boolean} forceUpdateWorld
	         */
	        update: function (forceUpdateWorld) {
	            if (this.autoUpdateLocalTransform) {
	                this.updateLocalTransform();
	            }
	            else {
	                // Transform is manually setted
	                forceUpdateWorld = true;
	            }

	            if (forceUpdateWorld || this._needsUpdateWorldTransform) {
	                this.updateWorldTransform();
	                forceUpdateWorld = true;
	                this._needsUpdateWorldTransform = false;
	            }

	            var children = this._children;
	            for(var i = 0, len = children.length; i < len; i++) {
	                children[i].update(forceUpdateWorld);
	            }
	        },

	        /**
	         * Get bounding box of node
	         * @param  {Function} [filter]
	         * @param  {qtek.math.BoundingBox} [out]
	         * @return {qtek.math.BoundingBox}
	         */
	        getBoundingBox: (function () {

	            function defaultFilter (el) {
	                return !el.invisible;
	            }
	            return function (filter, out) {
	                out = out || new BoundingBox();
	                filter = filter || defaultFilter;

	                var children = this._children;
	                if (children.length === 0) {
	                    out.max.set(-Infinity, -Infinity, -Infinity);
	                    out.min.set(Infinity, Infinity, Infinity);
	                }

	                var tmpBBox = new BoundingBox();
	                for (var i = 0; i < children.length; i++) {
	                    var child = children[i];
	                    if (!filter(child)) {
	                        continue;
	                    }
	                    child.getBoundingBox(filter, tmpBBox);
	                    child.updateLocalTransform();
	                    if (tmpBBox.isFinite()) {
	                        tmpBBox.applyTransform(child.localTransform);
	                    }
	                    if (i === 0) {
	                        out.copy(tmpBBox);
	                    }
	                    else {
	                        out.union(tmpBBox);
	                    }

	                }

	                return out;
	            };
	        })(),

	        /**
	         * Get world position, extracted from world transform
	         * @param  {qtek.math.Vector3} [out]
	         * @return {qtek.math.Vector3}
	         */
	        getWorldPosition: function (out) {
	            // TODO If update when get worldTransform
	            if (this.transformNeedsUpdate()) {
	                // Find the root node which transform needs update;
	                var rootNodeDirty = this;
	                while (rootNodeDirty && rootNodeDirty.getParent()
	                    && rootNodeDirty.getParent().transformNeedsUpdate()
	                ) {
	                    rootNodeDirty = rootNodeDirty.getParent();
	                }
	                rootNodeDirty.update();
	            }
	            var m = this.worldTransform._array;
	            if (out) {
	                var arr = out._array;
	                arr[0] = m[12];
	                arr[1] = m[13];
	                arr[2] = m[14];
	                return out;
	            }
	            else {
	                return new Vector3(m[12], m[13], m[14]);
	            }
	        },

	        // TODO Set world transform

	        /**
	         * Clone a new node
	         * @return {Node}
	         */
	        clone: function () {
	            var node = new this.constructor();
	            var children = this._children;

	            node.setName(this.name);
	            node.position.copy(this.position);
	            node.rotation.copy(this.rotation);
	            node.scale.copy(this.scale);

	            for (var i = 0; i < children.length; i++) {
	                node.add(children[i].clone());
	            }
	            return node;
	        },

	        /**
	         * Rotate the node around a axis by angle degrees, axis passes through point
	         * @param {qtek.math.Vector3} point Center point
	         * @param {qtek.math.Vector3} axis  Center axis
	         * @param {number}       angle Rotation angle
	         * @see http://docs.unity3d.com/Documentation/ScriptReference/Transform.RotateAround.html
	         * @method
	         */
	        rotateAround: (function () {
	            var v = new Vector3();
	            var RTMatrix = new Matrix4();

	            // TODO improve performance
	            return function (point, axis, angle) {

	                v.copy(this.position).subtract(point);

	                var localTransform = this.localTransform;
	                localTransform.identity();
	                // parent node
	                localTransform.translate(point);
	                localTransform.rotate(angle, axis);

	                RTMatrix.fromRotationTranslation(this.rotation, v);
	                localTransform.multiply(RTMatrix);
	                localTransform.scale(this.scale);

	                this.decomposeLocalTransform();
	                this._needsUpdateWorldTransform = true;
	            };
	        })(),

	        /**
	         * @param {qtek.math.Vector3} target
	         * @param {qtek.math.Vector3} [up]
	         * @see http://www.opengl.org/sdk/docs/man2/xhtml/gluLookAt.xml
	         * @method
	         */
	        // TODO world space ?
	        lookAt: (function () {
	            var m = new Matrix4();
	            return function (target, up) {
	                m.lookAt(this.position, target, up || this.localTransform.y).invert();
	                this.setLocalTransform(m);
	            };
	        })()
	    });

	    module.exports = Node;


/***/ },
/* 29 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';


	    var glMatrix = __webpack_require__(15);
	    var quat = glMatrix.quat;

	    /**
	     * @constructor
	     * @alias qtek.math.Quaternion
	     * @param {number} x
	     * @param {number} y
	     * @param {number} z
	     * @param {number} w
	     */
	    var Quaternion = function (x, y, z, w) {

	        x = x || 0;
	        y = y || 0;
	        z = z || 0;
	        w = w === undefined ? 1 : w;

	        /**
	         * Storage of Quaternion, read and write of x, y, z, w will change the values in _array
	         * All methods also operate on the _array instead of x, y, z, w components
	         * @name _array
	         * @type {Float32Array}
	         */
	        this._array = quat.fromValues(x, y, z, w);

	        /**
	         * Dirty flag is used by the Node to determine
	         * if the matrix is updated to latest
	         * @name _dirty
	         * @type {boolean}
	         */
	        this._dirty = true;
	    };

	    Quaternion.prototype = {

	        constructor: Quaternion,

	        /**
	         * Add b to self
	         * @param  {qtek.math.Quaternion} b
	         * @return {qtek.math.Quaternion}
	         */
	        add: function (b) {
	            quat.add(this._array, this._array, b._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Calculate the w component from x, y, z component
	         * @return {qtek.math.Quaternion}
	         */
	        calculateW: function () {
	            quat.calculateW(this._array, this._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Set x, y and z components
	         * @param  {number}  x
	         * @param  {number}  y
	         * @param  {number}  z
	         * @param  {number}  w
	         * @return {qtek.math.Quaternion}
	         */
	        set: function (x, y, z, w) {
	            this._array[0] = x;
	            this._array[1] = y;
	            this._array[2] = z;
	            this._array[3] = w;
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Set x, y, z and w components from array
	         * @param  {Float32Array|number[]} arr
	         * @return {qtek.math.Quaternion}
	         */
	        setArray: function (arr) {
	            this._array[0] = arr[0];
	            this._array[1] = arr[1];
	            this._array[2] = arr[2];
	            this._array[3] = arr[3];

	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Clone a new Quaternion
	         * @return {qtek.math.Quaternion}
	         */
	        clone: function () {
	            return new Quaternion(this.x, this.y, this.z, this.w);
	        },

	        /**
	         * Calculates the conjugate of self If the quaternion is normalized,
	         * this function is faster than invert and produces the same result.
	         *
	         * @return {qtek.math.Quaternion}
	         */
	        conjugate: function () {
	            quat.conjugate(this._array, this._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Copy from b
	         * @param  {qtek.math.Quaternion} b
	         * @return {qtek.math.Quaternion}
	         */
	        copy: function (b) {
	            quat.copy(this._array, b._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Dot product of self and b
	         * @param  {qtek.math.Quaternion} b
	         * @return {number}
	         */
	        dot: function (b) {
	            return quat.dot(this._array, b._array);
	        },

	        /**
	         * Set from the given 3x3 rotation matrix
	         * @param  {qtek.math.Matrix3} m
	         * @return {qtek.math.Quaternion}
	         */
	        fromMat3: function (m) {
	            quat.fromMat3(this._array, m._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Set from the given 4x4 rotation matrix
	         * The 4th column and 4th row will be droped
	         * @param  {qtek.math.Matrix4} m
	         * @return {qtek.math.Quaternion}
	         */
	        fromMat4: (function () {
	            var mat3 = glMatrix.mat3;
	            var m3 = mat3.create();
	            return function (m) {
	                mat3.fromMat4(m3, m._array);
	                // TODO Not like mat4, mat3 in glmatrix seems to be row-based
	                mat3.transpose(m3, m3);
	                quat.fromMat3(this._array, m3);
	                this._dirty = true;
	                return this;
	            };
	        })(),

	        /**
	         * Set to identity quaternion
	         * @return {qtek.math.Quaternion}
	         */
	        identity: function () {
	            quat.identity(this._array);
	            this._dirty = true;
	            return this;
	        },
	        /**
	         * Invert self
	         * @return {qtek.math.Quaternion}
	         */
	        invert: function () {
	            quat.invert(this._array, this._array);
	            this._dirty = true;
	            return this;
	        },
	        /**
	         * Alias of length
	         * @return {number}
	         */
	        len: function () {
	            return quat.len(this._array);
	        },

	        /**
	         * Calculate the length
	         * @return {number}
	         */
	        length: function () {
	            return quat.length(this._array);
	        },

	        /**
	         * Linear interpolation between a and b
	         * @param  {qtek.math.Quaternion} a
	         * @param  {qtek.math.Quaternion} b
	         * @param  {number}  t
	         * @return {qtek.math.Quaternion}
	         */
	        lerp: function (a, b, t) {
	            quat.lerp(this._array, a._array, b._array, t);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Alias for multiply
	         * @param  {qtek.math.Quaternion} b
	         * @return {qtek.math.Quaternion}
	         */
	        mul: function (b) {
	            quat.mul(this._array, this._array, b._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Alias for multiplyLeft
	         * @param  {qtek.math.Quaternion} a
	         * @return {qtek.math.Quaternion}
	         */
	        mulLeft: function (a) {
	            quat.multiply(this._array, a._array, this._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Mutiply self and b
	         * @param  {qtek.math.Quaternion} b
	         * @return {qtek.math.Quaternion}
	         */
	        multiply: function (b) {
	            quat.multiply(this._array, this._array, b._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Mutiply a and self
	         * Quaternion mutiply is not commutative, so the result of mutiplyLeft is different with multiply.
	         * @param  {qtek.math.Quaternion} a
	         * @return {qtek.math.Quaternion}
	         */
	        multiplyLeft: function (a) {
	            quat.multiply(this._array, a._array, this._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Normalize self
	         * @return {qtek.math.Quaternion}
	         */
	        normalize: function () {
	            quat.normalize(this._array, this._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Rotate self by a given radian about X axis
	         * @param {number} rad
	         * @return {qtek.math.Quaternion}
	         */
	        rotateX: function (rad) {
	            quat.rotateX(this._array, this._array, rad);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Rotate self by a given radian about Y axis
	         * @param {number} rad
	         * @return {qtek.math.Quaternion}
	         */
	        rotateY: function (rad) {
	            quat.rotateY(this._array, this._array, rad);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Rotate self by a given radian about Z axis
	         * @param {number} rad
	         * @return {qtek.math.Quaternion}
	         */
	        rotateZ: function (rad) {
	            quat.rotateZ(this._array, this._array, rad);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Sets self to represent the shortest rotation from Vector3 a to Vector3 b.
	         * a and b needs to be normalized
	         * @param  {qtek.math.Vector3} a
	         * @param  {qtek.math.Vector3} b
	         * @return {qtek.math.Quaternion}
	         */
	        rotationTo: function (a, b) {
	            quat.rotationTo(this._array, a._array, b._array);
	            this._dirty = true;
	            return this;
	        },
	        /**
	         * Sets self with values corresponding to the given axes
	         * @param {qtek.math.Vector3} view
	         * @param {qtek.math.Vector3} right
	         * @param {qtek.math.Vector3} up
	         * @return {qtek.math.Quaternion}
	         */
	        setAxes: function (view, right, up) {
	            quat.setAxes(this._array, view._array, right._array, up._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Sets self with a rotation axis and rotation angle
	         * @param {qtek.math.Vector3} axis
	         * @param {number} rad
	         * @return {qtek.math.Quaternion}
	         */
	        setAxisAngle: function (axis, rad) {
	            quat.setAxisAngle(this._array, axis._array, rad);
	            this._dirty = true;
	            return this;
	        },
	        /**
	         * Perform spherical linear interpolation between a and b
	         * @param  {qtek.math.Quaternion} a
	         * @param  {qtek.math.Quaternion} b
	         * @param  {number} t
	         * @return {qtek.math.Quaternion}
	         */
	        slerp: function (a, b, t) {
	            quat.slerp(this._array, a._array, b._array, t);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Alias for squaredLength
	         * @return {number}
	         */
	        sqrLen: function () {
	            return quat.sqrLen(this._array);
	        },

	        /**
	         * Squared length of self
	         * @return {number}
	         */
	        squaredLength: function () {
	            return quat.squaredLength(this._array);
	        },

	        /**
	         * Set from euler
	         * @param {qtek.math.Vector3} v
	         * @param {String} order
	         */
	        fromEuler: function (v, order) {
	            return Quaternion.fromEuler(this, v, order);
	        },

	        toString: function () {
	            return '[' + Array.prototype.join.call(this._array, ',') + ']';
	        },

	        toArray: function () {
	            return Array.prototype.slice.call(this._array);
	        }
	    };

	    var defineProperty = Object.defineProperty;
	    // Getter and Setter
	    if (defineProperty) {

	        var proto = Quaternion.prototype;
	        /**
	         * @name x
	         * @type {number}
	         * @memberOf qtek.math.Quaternion
	         * @instance
	         */
	        defineProperty(proto, 'x', {
	            get: function () {
	                return this._array[0];
	            },
	            set: function (value) {
	                this._array[0] = value;
	                this._dirty = true;
	            }
	        });

	        /**
	         * @name y
	         * @type {number}
	         * @memberOf qtek.math.Quaternion
	         * @instance
	         */
	        defineProperty(proto, 'y', {
	            get: function () {
	                return this._array[1];
	            },
	            set: function (value) {
	                this._array[1] = value;
	                this._dirty = true;
	            }
	        });

	        /**
	         * @name z
	         * @type {number}
	         * @memberOf qtek.math.Quaternion
	         * @instance
	         */
	        defineProperty(proto, 'z', {
	            get: function () {
	                return this._array[2];
	            },
	            set: function (value) {
	                this._array[2] = value;
	                this._dirty = true;
	            }
	        });

	        /**
	         * @name w
	         * @type {number}
	         * @memberOf qtek.math.Quaternion
	         * @instance
	         */
	        defineProperty(proto, 'w', {
	            get: function () {
	                return this._array[3];
	            },
	            set: function (value) {
	                this._array[3] = value;
	                this._dirty = true;
	            }
	        });
	    }

	    // Supply methods that are not in place

	    /**
	     * @param  {qtek.math.Quaternion} out
	     * @param  {qtek.math.Quaternion} a
	     * @param  {qtek.math.Quaternion} b
	     * @return {qtek.math.Quaternion}
	     */
	    Quaternion.add = function (out, a, b) {
	        quat.add(out._array, a._array, b._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Quaternion} out
	     * @param  {number}     x
	     * @param  {number}     y
	     * @param  {number}     z
	     * @param  {number}     w
	     * @return {qtek.math.Quaternion}
	     */
	    Quaternion.set = function (out, x, y, z, w) {
	        quat.set(out._array, x, y, z, w);
	        out._dirty = true;
	    };

	    /**
	     * @param  {qtek.math.Quaternion} out
	     * @param  {qtek.math.Quaternion} b
	     * @return {qtek.math.Quaternion}
	     */
	    Quaternion.copy = function (out, b) {
	        quat.copy(out._array, b._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Quaternion} out
	     * @param  {qtek.math.Quaternion} a
	     * @return {qtek.math.Quaternion}
	     */
	    Quaternion.calculateW = function (out, a) {
	        quat.calculateW(out._array, a._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Quaternion} out
	     * @param  {qtek.math.Quaternion} a
	     * @return {qtek.math.Quaternion}
	     */
	    Quaternion.conjugate = function (out, a) {
	        quat.conjugate(out._array, a._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Quaternion} out
	     * @return {qtek.math.Quaternion}
	     */
	    Quaternion.identity = function (out) {
	        quat.identity(out._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Quaternion} out
	     * @param  {qtek.math.Quaternion} a
	     * @return {qtek.math.Quaternion}
	     */
	    Quaternion.invert = function (out, a) {
	        quat.invert(out._array, a._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Quaternion} a
	     * @param  {qtek.math.Quaternion} b
	     * @return {number}
	     */
	    Quaternion.dot = function (a, b) {
	        return quat.dot(a._array, b._array);
	    };

	    /**
	     * @param  {qtek.math.Quaternion} a
	     * @return {number}
	     */
	    Quaternion.len = function (a) {
	        return quat.length(a._array);
	    };

	    // Quaternion.length = Quaternion.len;

	    /**
	     * @param  {qtek.math.Quaternion} out
	     * @param  {qtek.math.Quaternion} a
	     * @param  {qtek.math.Quaternion} b
	     * @param  {number}     t
	     * @return {qtek.math.Quaternion}
	     */
	    Quaternion.lerp = function (out, a, b, t) {
	        quat.lerp(out._array, a._array, b._array, t);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Quaternion} out
	     * @param  {qtek.math.Quaternion} a
	     * @param  {qtek.math.Quaternion} b
	     * @param  {number}     t
	     * @return {qtek.math.Quaternion}
	     */
	    Quaternion.slerp = function (out, a, b, t) {
	        quat.slerp(out._array, a._array, b._array, t);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Quaternion} out
	     * @param  {qtek.math.Quaternion} a
	     * @param  {qtek.math.Quaternion} b
	     * @return {qtek.math.Quaternion}
	     */
	    Quaternion.mul = function (out, a, b) {
	        quat.multiply(out._array, a._array, b._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @method
	     * @param  {qtek.math.Quaternion} out
	     * @param  {qtek.math.Quaternion} a
	     * @param  {qtek.math.Quaternion} b
	     * @return {qtek.math.Quaternion}
	     */
	    Quaternion.multiply = Quaternion.mul;

	    /**
	     * @param  {qtek.math.Quaternion} out
	     * @param  {qtek.math.Quaternion} a
	     * @param  {number}     rad
	     * @return {qtek.math.Quaternion}
	     */
	    Quaternion.rotateX = function (out, a, rad) {
	        quat.rotateX(out._array, a._array, rad);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Quaternion} out
	     * @param  {qtek.math.Quaternion} a
	     * @param  {number}     rad
	     * @return {qtek.math.Quaternion}
	     */
	    Quaternion.rotateY = function (out, a, rad) {
	        quat.rotateY(out._array, a._array, rad);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Quaternion} out
	     * @param  {qtek.math.Quaternion} a
	     * @param  {number}     rad
	     * @return {qtek.math.Quaternion}
	     */
	    Quaternion.rotateZ = function (out, a, rad) {
	        quat.rotateZ(out._array, a._array, rad);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Quaternion} out
	     * @param  {qtek.math.Vector3}    axis
	     * @param  {number}     rad
	     * @return {qtek.math.Quaternion}
	     */
	    Quaternion.setAxisAngle = function (out, axis, rad) {
	        quat.setAxisAngle(out._array, axis._array, rad);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Quaternion} out
	     * @param  {qtek.math.Quaternion} a
	     * @return {qtek.math.Quaternion}
	     */
	    Quaternion.normalize = function (out, a) {
	        quat.normalize(out._array, a._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Quaternion} a
	     * @return {number}
	     */
	    Quaternion.sqrLen = function (a) {
	        return quat.sqrLen(a._array);
	    };

	    /**
	     * @method
	     * @param  {qtek.math.Quaternion} a
	     * @return {number}
	     */
	    Quaternion.squaredLength = Quaternion.sqrLen;

	    /**
	     * @param  {qtek.math.Quaternion} out
	     * @param  {qtek.math.Matrix3}    m
	     * @return {qtek.math.Quaternion}
	     */
	    Quaternion.fromMat3 = function (out, m) {
	        quat.fromMat3(out._array, m._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Quaternion} out
	     * @param  {qtek.math.Vector3}    view
	     * @param  {qtek.math.Vector3}    right
	     * @param  {qtek.math.Vector3}    up
	     * @return {qtek.math.Quaternion}
	     */
	    Quaternion.setAxes = function (out, view, right, up) {
	        quat.setAxes(out._array, view._array, right._array, up._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Quaternion} out
	     * @param  {qtek.math.Vector3}    a
	     * @param  {qtek.math.Vector3}    b
	     * @return {qtek.math.Quaternion}
	     */
	    Quaternion.rotationTo = function (out, a, b) {
	        quat.rotationTo(out._array, a._array, b._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * Set quaternion from euler
	     * @param {qtek.math.Quaternion} out
	     * @param {qtek.math.Vector3} v
	     * @param {String} order
	     */
	    Quaternion.fromEuler = function (out, v, order) {

	        out._dirty = true;

	        v = v._array;
	        var target = out._array;
	        var c1 = Math.cos(v[0] / 2);
	        var c2 = Math.cos(v[1] / 2);
	        var c3 = Math.cos(v[2] / 2);
	        var s1 = Math.sin(v[0] / 2);
	        var s2 = Math.sin(v[1] / 2);
	        var s3 = Math.sin(v[2] / 2);

	        var order = (order || 'XYZ').toUpperCase();

	        // http://www.mathworks.com/matlabcentral/fileexchange/
	        //  20696-function-to-convert-between-dcm-euler-angles-quaternions-and-euler-vectors/
	        //  content/SpinCalc.m

	        switch (order) {
	            case 'XYZ':
	                target[0] = s1 * c2 * c3 + c1 * s2 * s3;
	                target[1] = c1 * s2 * c3 - s1 * c2 * s3;
	                target[2] = c1 * c2 * s3 + s1 * s2 * c3;
	                target[3] = c1 * c2 * c3 - s1 * s2 * s3;
	                break;
	            case 'YXZ':
	                target[0] = s1 * c2 * c3 + c1 * s2 * s3;
	                target[1] = c1 * s2 * c3 - s1 * c2 * s3;
	                target[2] = c1 * c2 * s3 - s1 * s2 * c3;
	                target[3] = c1 * c2 * c3 + s1 * s2 * s3;
	                break;
	            case 'ZXY':
	                target[0] = s1 * c2 * c3 - c1 * s2 * s3;
	                target[1] = c1 * s2 * c3 + s1 * c2 * s3;
	                target[2] = c1 * c2 * s3 + s1 * s2 * c3;
	                target[3] = c1 * c2 * c3 - s1 * s2 * s3;
	                break;
	            case 'ZYX':
	                target[0] = s1 * c2 * c3 - c1 * s2 * s3;
	                target[1] = c1 * s2 * c3 + s1 * c2 * s3;
	                target[2] = c1 * c2 * s3 - s1 * s2 * c3;
	                target[3] = c1 * c2 * c3 + s1 * s2 * s3;
	                break;
	            case 'YZX':
	                target[0] = s1 * c2 * c3 + c1 * s2 * s3;
	                target[1] = c1 * s2 * c3 + s1 * c2 * s3;
	                target[2] = c1 * c2 * s3 - s1 * s2 * c3;
	                target[3] = c1 * c2 * c3 - s1 * s2 * s3;
	                break;
	            case 'XZY':
	                target[0] = s1 * c2 * c3 - c1 * s2 * s3;
	                target[1] = c1 * s2 * c3 - s1 * c2 * s3;
	                target[2] = c1 * c2 * s3 + s1 * s2 * c3;
	                target[3] = c1 * c2 * c3 + s1 * s2 * s3;
	                break;
	        }
	    };

	    module.exports = Quaternion;


/***/ },
/* 30 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	/**
	 *
	 * PENDING: use perfermance hint and remove the array after the data is transfered?
	 * static draw & dynamic draw?
	 */


	    var Geometry = __webpack_require__(31);
	    var BoundingBox = __webpack_require__(13);
	    var glenum = __webpack_require__(11);
	    var glinfo = __webpack_require__(10);
	    var vendor = __webpack_require__(12);

	    var glMatrix = __webpack_require__(15);
	    var vec3 = glMatrix.vec3;
	    var mat4 = glMatrix.mat4;

	    var vec3Add = vec3.add;
	    var vec3Create = vec3.create;

	    var arrSlice = Array.prototype.slice;

	    var DynamicAttribute = Geometry.DynamicAttribute;

	    /**
	     * @constructor qtek.DynamicGeometry
	     * @extends qtek.Geometry
	     */
	    var DynamicGeometry = Geometry.extend(function () {
	        return /** @lends qtek.DynamicGeometry# */ {
	            attributes: {
	                 position: new DynamicAttribute('position', 'float', 3, 'POSITION'),
	                 texcoord0: new DynamicAttribute('texcoord0', 'float', 2, 'TEXCOORD_0'),
	                 texcoord1: new DynamicAttribute('texcoord1', 'float', 2, 'TEXCOORD_1'),
	                 normal: new DynamicAttribute('normal', 'float', 3, 'NORMAL'),
	                 tangent: new DynamicAttribute('tangent', 'float', 4, 'TANGENT'),
	                 color: new DynamicAttribute('color', 'float', 4, 'COLOR'),
	                 // Skinning attributes
	                 // Each vertex can be bind to 4 bones, because the
	                 // sum of weights is 1, so the weights is stored in vec3 and the last
	                 // can be calculated by 1-w.x-w.y-w.z
	                 weight: new DynamicAttribute('weight', 'float', 3, 'WEIGHT'),
	                 joint: new DynamicAttribute('joint', 'float', 4, 'JOINT'),
	                 // For wireframe display
	                 // http://codeflow.org/entries/2012/aug/02/easy-wireframe-display-with-barycentric-coordinates/
	                 barycentric: new DynamicAttribute('barycentric', 'float', 3, null)
	            },

	            dynamic: true,

	            hint: glenum.DYNAMIC_DRAW,

	            // Face is list of triangles, each face
	            // is an array of the vertex indices of triangle

	            /**
	             * @type {array}
	             */
	            faces: [],

	            _enabledAttributes: null,

	            // Typed Array of each geometry chunk
	            // [{
	            //     attributeArrays:{
	            //         position: TypedArray
	            //     },
	            //     indicesArray: null
	            // }]
	            _arrayChunks: []
	        };
	    },
	    /** @lends qtek.DynamicGeometry.prototype */
	    {
	        updateBoundingBox: function () {
	            var bbox = this.boundingBox;
	            if (! bbox) {
	                bbox = this.boundingBox = new BoundingBox();
	            }
	            bbox.updateFromVertices(this.attributes.position.value);
	        },
	        // Overwrite the dirty method
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

	        getFace: function (idx, out) {
	            if (idx < this.faceCount && idx >= 0) {
	                if (!out) {
	                    out = vec3.create();
	                }
	                vec3.copy(out, this.faces[idx]);

	                return out;
	            }
	        },

	        setFace: function (idx, arr) {
	            this.faces[idx] = this.faces[idx] || vec3Create();
	            vec3.copy(this.faces[idx], arr);
	        },

	        isUseFace: function () {
	            return this.useFace && (this.faces.length > 0);
	        },

	        isSplitted: function () {
	            return this.vertexCount > 0xffff;
	        },

	        createAttribute: function (name, type, size, semantic) {
	            var attrib = new DynamicAttribute(name, type, size, semantic);
	            if (this.attributes[name]) {
	                this.removeAttribute(name);
	            }
	            this.attributes[name] = attrib;
	            this._attributeList.push(name);
	            return attrib;
	        },

	        removeAttribute: function (name) {
	            var attributeList = this._attributeList;
	            var idx = attributeList.indexOf(name);
	            if (idx >= 0) {
	                attributeList.splice(idx, 1);
	                delete this.attributes[name];
	                return true;
	            }
	            return false;
	        },

	        /**
	         * Get enabled attributes map.
	         * Attribute that has same vertex number with position is treated as an enabled attribute
	         * @return {Object}
	         */
	        getEnabledAttributes: function () {
	            var enabledAttributes = this._enabledAttributes;
	            var attributeList = this._attributeList;
	            // Cache
	            if (enabledAttributes) {
	                return enabledAttributes;
	            }

	            var result = {};
	            var nVertex = this.vertexCount;

	            for (var i = 0; i < attributeList.length; i++) {
	                var name = attributeList[i];
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
	            var cache = this._cache;

	            if (cache.miss('chunks')) {
	                return attributes;
	            }
	            else {
	                var result = {};
	                var noDirtyAttributes = true;
	                for (var name in attributes) {
	                    if (cache.isDirty(name)) {
	                        result[name] = attributes[name];
	                        noDirtyAttributes = false;
	                    }
	                }
	                if (! noDirtyAttributes) {
	                    return result;
	                }
	            }
	        },

	        getChunkNumber: function () {
	            return this._arrayChunks.length;
	        },

	        getBufferChunks: function (_gl) {
	            var cache = this._cache;
	            cache.use(_gl.__GLID__);

	            if (cache.isDirty()) {
	                var dirtyAttributes = this._getDirtyAttributes();

	                var isFacesDirty = cache.isDirty('indices');
	                isFacesDirty = isFacesDirty && this.isUseFace();

	                if (dirtyAttributes) {
	                    this._updateAttributesAndIndicesArrays(
	                        dirtyAttributes, isFacesDirty,
	                        glinfo.getExtension(_gl, 'OES_element_index_uint') != null
	                    );
	                    this._updateBuffer(_gl, dirtyAttributes, isFacesDirty);

	                    for (var name in dirtyAttributes) {
	                        cache.fresh(name);
	                    }
	                    cache.fresh('indices');
	                    cache.fresh();
	                }
	            }
	            return cache.get('chunks');
	        },

	        _updateAttributesAndIndicesArrays: function (attributes, isFacesDirty, useUintExtension) {

	            var self = this;
	            var nVertex = this.vertexCount;

	            var verticesReorganizedMap = [];
	            var reorganizedFaces = [];

	            var ArrayConstructors = {};
	            for (var name in attributes) {
	                // Type can be byte, ubyte, short, ushort, float
	                switch (attributes[name].type) {
	                    case 'byte':
	                        ArrayConstructors[name] = vendor.Int8Array;
	                        break;
	                    case 'ubyte':
	                        ArrayConstructors[name] = vendor.Uint8Array;
	                        break;
	                    case 'short':
	                        ArrayConstructors[name] = vendor.Int16Array;
	                        break;
	                    case 'ushort':
	                        ArrayConstructors[name] = vendor.Uint16Array;
	                        break;
	                    default:
	                        ArrayConstructors[name] = vendor.Float32Array;
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
	            // Split large geometry into chunks because index buffer
	            // only can use uint16 which means each draw call can only
	            // have at most 65535 vertex data
	            // But now most browsers support OES_element_index_uint extension
	            if (
	                nVertex > 0xffff && this.isUseFace() && !useUintExtension
	            ) {
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
	                        reorganizedFaces[i] = [0, 0, 0];
	                    }
	                }

	                currentChunk = newChunk(chunkIdx);

	                var vertexCount = 0;
	                for (var i = 0; i < this.faces.length; i++) {
	                    var face = this.faces[i];
	                    var reorganizedFace = reorganizedFaces[i];

	                    // newChunk
	                    if (vertexCount + 3 > 0xffff) {
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
	                            if (! attribArray) {
	                                // Here use array to put data temporary because i can't predict
	                                // the size of chunk precisely.
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
	                        }
	                        else {
	                            reorganizedFace[f] = verticesReorganizedMap[ii];
	                        }
	                    }
	                }
	                //Create typedArray from existed array
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
	                        chunkEnd = chunkFaceStart[c+1] || this.faces.length;
	                        cursor = 0;
	                        chunk = this._arrayChunks[c];
	                        var indicesArray = chunk.indicesArray;
	                        if (! indicesArray) {
	                            indicesArray = chunk.indicesArray = new Uint16Array((chunkEnd-chunkStart)*3);
	                        }

	                        for (var i = chunkStart; i < chunkEnd; i++) {
	                            indicesArray[cursor++] = reorganizedFaces[i][0];
	                            indicesArray[cursor++] = reorganizedFaces[i][1];
	                            indicesArray[cursor++] = reorganizedFaces[i][2];
	                        }
	                    }
	                }
	            }
	            else {
	                var chunk = newChunk(0);
	                // Use faces
	                if (isFacesDirty) {
	                    var indicesArray = chunk.indicesArray;
	                    var nFace = this.faces.length;
	                    if (!indicesArray || (nFace * 3 !== indicesArray.length)) {
	                        var ArrayCtor = nVertex > 0xffff ? Uint32Array : Uint16Array;
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
	                    if (! attribArray || attribArray.length !== arrSize) {
	                        attribArray = new ArrayConstructors[name](arrSize);
	                        chunk.attributeArrays[name] = attribArray;
	                    }

	                    if (size === 1) {
	                        for (var i = 0; i < values.length; i++) {
	                            attribArray[i] = values[i];
	                        }
	                    }
	                    else {
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
	            if (! chunks) {
	                chunks = [];
	                // Intialize
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
	                if (! chunk) {
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
	                    }
	                    else {
	                        buffer = _gl.createBuffer();
	                    }
	                    //TODO: Use BufferSubData?
	                    _gl.bindBuffer(_gl.ARRAY_BUFFER, buffer);
	                    _gl.bufferData(_gl.ARRAY_BUFFER, attributeArrays[name], this.hint);

	                    attributeBuffers[count++] = new Geometry.AttributeBuffer(name, type, buffer, size, semantic);
	                }
	                attributeBuffers.length = count;

	                if (isFacesDirty) {
	                    if (! indicesBuffer) {
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
	            var attributes = this.attributes;
	            var positions = attributes.position.value;
	            var normals = attributes.normal.value;
	            var normal = vec3Create();

	            var v21 = vec3Create(), v32 = vec3Create();

	            for (var i = 0; i < normals.length; i++) {
	                vec3.set(normals[i], 0.0, 0.0, 0.0);
	            }
	            for (var i = normals.length; i < positions.length; i++) {
	                //Use array instead of Float32Array
	                normals[i] = [0.0, 0.0, 0.0];
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
	                // Weighted by the triangle area
	                vec3Add(normals[i1], normals[i1], normal);
	                vec3Add(normals[i2], normals[i2], normal);
	                vec3Add(normals[i3], normals[i3], normal);
	            }
	            for (var i = 0; i < normals.length; i++) {
	                vec3.normalize(normals[i], normals[i]);
	            }
	        },

	        generateFaceNormals: function () {
	            if (! this.isUniqueVertex()) {
	                this.generateUniqueVertex();
	            }

	            var faces = this.faces;
	            var len = faces.length;
	            var attributes = this.attributes;
	            var positions = attributes.position.value;
	            var normals = attributes.normal.value;
	            var normal = vec3Create();

	            var v21 = vec3Create(), v32 = vec3Create();

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

	                vec3.normalize(normal, normal);

	                if (isCopy) {
	                    vec3.copy(normals[i1], normal);
	                    vec3.copy(normals[i2], normal);
	                    vec3.copy(normals[i3], normal);
	                }
	                else {
	                    normals[i1] = normals[i2] = normals[i3] = arrSlice.call(normal);
	                }
	            }
	        },
	        // 'Mathmatics for 3D programming and computer graphics, third edition'
	        // section 7.8.2
	        // http://www.crytek.com/download/Triangle_mesh_tangent_space_calculation.pdf
	        generateTangents: function () {

	            var attributes = this.attributes;
	            var texcoords = attributes.texcoord0.value;
	            var positions = attributes.position.value;
	            var tangents = attributes.tangent.value;
	            var normals = attributes.normal.value;

	            var tan1 = [];
	            var tan2 = [];
	            var nVertex = this.vertexCount;
	            for (var i = 0; i < nVertex; i++) {
	                tan1[i] = [0.0, 0.0, 0.0];
	                tan2[i] = [0.0, 0.0, 0.0];
	            }

	            var sdir = [0.0, 0.0, 0.0];
	            var tdir = [0.0, 0.0, 0.0];
	            for (var i = 0; i < this.faces.length; i++) {
	                var face = this.faces[i],
	                    i1 = face[0],
	                    i2 = face[1],
	                    i3 = face[2],

	                    st1 = texcoords[i1],
	                    st2 = texcoords[i2],
	                    st3 = texcoords[i3],

	                    p1 = positions[i1],
	                    p2 = positions[i2],
	                    p3 = positions[i3];

	                var x1 = p2[0] - p1[0],
	                    x2 = p3[0] - p1[0],
	                    y1 = p2[1] - p1[1],
	                    y2 = p3[1] - p1[1],
	                    z1 = p2[2] - p1[2],
	                    z2 = p3[2] - p1[2];

	                var s1 = st2[0] - st1[0],
	                    s2 = st3[0] - st1[0],
	                    t1 = st2[1] - st1[1],
	                    t2 = st3[1] - st1[1];

	                var r = 1.0 / (s1 * t2 - t1 * s2);
	                sdir[0] = (t2 * x1 - t1 * x2) * r;
	                sdir[1] = (t2 * y1 - t1 * y2) * r;
	                sdir[2] = (t2 * z1 - t1 * z2) * r;

	                tdir[0] = (s1 * x2 - s2 * x1) * r;
	                tdir[1] = (s1 * y2 - s2 * y1) * r;
	                tdir[2] = (s1 * z2 - s2 * z1) * r;

	                vec3Add(tan1[i1], tan1[i1], sdir);
	                vec3Add(tan1[i2], tan1[i2], sdir);
	                vec3Add(tan1[i3], tan1[i3], sdir);
	                vec3Add(tan2[i1], tan2[i1], tdir);
	                vec3Add(tan2[i2], tan2[i2], tdir);
	                vec3Add(tan2[i3], tan2[i3], tdir);
	            }
	            var tmp = [0, 0, 0, 0];
	            var nCrossT = [0, 0, 0];
	            for (var i = 0; i < nVertex; i++) {
	                var n = normals[i];
	                var t = tan1[i];

	                // Gram-Schmidt orthogonalize
	                vec3.scale(tmp, n, vec3.dot(n, t));
	                vec3.sub(tmp, t, tmp);
	                vec3.normalize(tmp, tmp);
	                // Calculate handedness.
	                vec3.cross(nCrossT, n, t);
	                tmp[3] = vec3.dot(nCrossT, tan2[i]) < 0.0 ? -1.0 : 1.0;
	                tangents[i] = tmp.slice();
	            }
	        },

	        isUniqueVertex: function () {
	            if (this.isUseFace()) {
	                return this.vertexCount === this.faces.length * 3;
	            }
	            else {
	                return true;
	            }
	        },

	        generateUniqueVertex: function () {

	            var vertexUseCount = [];
	            // Intialize with empty value, read undefined value from array
	            // is slow
	            // http://jsperf.com/undefined-array-read
	            for (var i = 0; i < this.vertexCount; i++) {
	                vertexUseCount[i] = 0;
	            }

	            var cursor = this.vertexCount;
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
	                            }
	                            else {
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

	        // http://codeflow.org/entries/2012/aug/02/easy-wireframe-display-with-barycentric-coordinates/
	        // http://en.wikipedia.org/wiki/Barycentric_coordinate_system_(mathematics)
	        generateBarycentric: (function () {
	            var a = [1, 0, 0];
	            var b = [0, 0, 1];
	            var c = [0, 1, 0];
	            return function () {

	                if (! this.isUniqueVertex()) {
	                    this.generateUniqueVertex();
	                }

	                var array = this.attributes.barycentric.value;
	                // Already existed;
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
	        })(),

	        convertToStatic: function (geometry, useUintExtension) {
	            this._updateAttributesAndIndicesArrays(this.getEnabledAttributes(), true, useUintExtension);

	            if (this._arrayChunks.length > 1) {
	                console.warn('Large geometry will discard chunks when convert to StaticGeometry');
	            }
	            else if (this._arrayChunks.length === 0) {
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
	            // PENDING copy buffer ?
	            return geometry;
	        },

	        applyTransform: function (matrix) {
	            var attributes = this.attributes;
	            var positions = attributes.position.value;
	            var normals = attributes.normal.value;
	            var tangents = attributes.tangent.value;

	            var vec3TransformMat4 = vec3.transformMat4;

	            matrix = matrix._array;
	            for (var i = 0; i < positions.length; i++) {
	                vec3TransformMat4(positions[i], positions[i], matrix);
	            }
	            // Normal Matrix
	            var inverseTransposeMatrix = mat4.create();
	            mat4.invert(inverseTransposeMatrix, matrix);
	            mat4.transpose(inverseTransposeMatrix, inverseTransposeMatrix);

	            for (var i = 0; i < normals.length; i++) {
	                vec3TransformMat4(normals[i], normals[i], inverseTransposeMatrix);
	            }

	            for (var i = 0; i < tangents.length; i++) {
	                vec3TransformMat4(tangents[i], tangents[i], inverseTransposeMatrix);
	            }

	            if (this.boundingBox) {
	                this.updateBoundingBox();
	            }
	        },

	        dispose: function (_gl) {
	            var cache = this._cache;
	            cache.use(_gl.__GLID__);
	            var chunks = cache.get('chunks');
	            if (chunks) {
	                for (var c = 0; c < chunks.length; c++) {
	                    var chunk = chunks[c];
	                    for (var k = 0; k < chunk.attributeBuffers.length; k++) {
	                        var attribs = chunk.attributeBuffers[k];
	                        _gl.deleteBuffer(attribs.buffer);
	                    }
	                }
	            }
	            cache.deleteContext(_gl.__GLID__);
	        }
	    });

	    if (Object.defineProperty) {
	        Object.defineProperty(DynamicGeometry.prototype, 'vertexCount', {

	            enumerable: false,

	            get: function () {
	                var mainAttribute = this.attributes[this.mainAttribute];
	                if (!mainAttribute || !mainAttribute.value) {
	                    return 0;
	                }
	                return mainAttribute.value.length;
	            }
	        });
	        Object.defineProperty(DynamicGeometry.prototype, 'faceCount', {

	            enumerable: false,

	            get: function () {
	                return this.faces.length;
	            }
	        });
	    }


	    DynamicAttribute.Attribute = Geometry.DynamicAttribute;

	    module.exports = DynamicGeometry;


/***/ },
/* 31 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';


	    var Base = __webpack_require__(6);
	    var glenum = __webpack_require__(11);
	    var Cache = __webpack_require__(19);
	    var vendor = __webpack_require__(12);
	    var glmatrix = __webpack_require__(15);
	    var vec2 = glmatrix.vec2;
	    var vec3 = glmatrix.vec3;
	    var vec4 = glmatrix.vec4;

	    var vec4Copy = vec4.copy;
	    var vec3Copy = vec3.copy;
	    var vec2Copy = vec2.copy;

	    function getArrayCtorByType (type) {
	        var ArrayConstructor;
	        switch(type) {
	            case 'byte':
	                ArrayConstructor = vendor.Int8Array;
	                break;
	            case 'ubyte':
	                ArrayConstructor = vendor.Uint8Array;
	                break;
	            case 'short':
	                ArrayConstructor = vendor.Int16Array;
	                break;
	            case 'ushort':
	                ArrayConstructor = vendor.Uint16Array;
	                break;
	            default:
	                ArrayConstructor = vendor.Float32Array;
	                break;
	        }
	        return ArrayConstructor;
	    }


	    function Attribute(name, type, size, semantic) {
	        this.name = name;
	        this.type = type;
	        this.size = size;
	        if (semantic) {
	            this.semantic = semantic;
	        }
	    }
	    Attribute.prototype.clone = function(copyValue) {
	        var ret = new this.constructor(this.name, this.type, this.size, this.semantic);
	        // FIXME
	        if (copyValue) {
	            console.warn('todo');
	        }
	        return ret;
	    };


	    /**
	     * Attribute for static geometry
	     */
	    function StaticAttribute (name, type, size, semantic) {
	        Attribute.call(this, name, type, size, semantic);
	        this.value = null;

	        // Init getter setter
	        switch (size) {
	            case 1:
	                this.get = function (idx) {
	                    return this.value[idx];
	                };
	                this.set = function (idx, value) {
	                    this.value[idx] = value;
	                };
	                // Copy from source to target
	                this.copy = function (target, source) {
	                    this.value[target] = this.value[target];
	                };
	                break;
	            case 2:
	                this.get = function (idx, out) {
	                    var arr = this.value;
	                    out[0] = arr[idx * 2];
	                    out[1] = arr[idx * 2 + 1];
	                    return out;
	                };
	                this.set = function (idx, val) {
	                    var arr = this.value;
	                    arr[idx * 2] = val[0];
	                    arr[idx * 2 + 1] = val[1];
	                };
	                this.copy = function (target, source) {
	                    var arr = this.value;
	                    source *= 2;
	                    target *= 2;
	                    arr[target] = arr[source];
	                    arr[target + 1] = arr[source + 1];
	                };
	                break;
	            case 3:
	                this.get = function (idx, out) {
	                    var idx3 = idx * 3;
	                    var arr = this.value;
	                    out[0] = arr[idx3++];
	                    out[1] = arr[idx3++];
	                    out[2] = arr[idx3++];
	                    return out;
	                };
	                this.set = function (idx, val) {
	                    var idx3 = idx * 3;
	                    var arr = this.value;
	                    arr[idx3++] = val[0];
	                    arr[idx3++] = val[1];
	                    arr[idx3++] = val[2];
	                };
	                this.copy = function (target, source) {
	                    var arr = this.value;
	                    source *= 3;
	                    target *= 3;
	                    arr[target] = arr[source];
	                    arr[target + 1] = arr[source + 1];
	                    arr[target + 2] = arr[source + 2];
	                };
	                break;
	            case 4:
	                this.get = function (idx, out) {
	                    var arr = this.value;
	                    var idx4 = idx * 4;
	                    out[0] = arr[idx4++];
	                    out[1] = arr[idx4++];
	                    out[2] = arr[idx4++];
	                    out[3] = arr[idx4++];
	                    return out;
	                };
	                this.set = function (idx, val) {
	                    var arr = this.value;
	                    var idx4 = idx * 4;
	                    arr[idx4++] = val[0];
	                    arr[idx4++] = val[1];
	                    arr[idx4++] = val[2];
	                    arr[idx4++] = val[3];
	                };
	                this.copy = function (target, source) {
	                    var arr = this.value;
	                    source *= 4;
	                    target *= 4;
	                    // copyWithin is extremely slow
	                    arr[target] = arr[source];
	                    arr[target + 1] = arr[source + 1];
	                    arr[target + 2] = arr[source + 2];
	                    arr[target + 3] = arr[source + 3];
	                };
	        }
	    }

	    StaticAttribute.prototype.constructor = new Attribute();

	    StaticAttribute.prototype.init = function (nVertex) {
	        if (!this.value || this.value.length != nVertex * this.size) {
	            var ArrayConstructor = getArrayCtorByType(this.type);
	            this.value = new ArrayConstructor(nVertex * this.size);
	        }
	    };

	    StaticAttribute.prototype.fromArray = function (array) {
	        var ArrayConstructor = getArrayCtorByType(this.type);
	        var value;
	        // Convert 2d array to flat
	        if (array[0] && (array[0].length)) {
	            var n = 0;
	            var size = this.size;
	            value = new ArrayConstructor(array.length * size);
	            for (var i = 0; i < array.length; i++) {
	                for (var j = 0; j < size; j++) {
	                    value[n++] = array[i][j];
	                }
	            }
	        }
	        else {
	            value = new ArrayConstructor(array);
	        }
	        this.value = value;
	    };

	    /**
	     * Attribute for dynamic geometry
	     */
	    function DynamicAttribute (name, type, size, semantic) {
	        Attribute.call(this, name, type, size, semantic);
	        this.value = [];

	        // Init getter setter
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
	                this.get = function (idx, out) {
	                    var item = this.value[idx];
	                    if (item) {
	                        vec2Copy(out, item);
	                    }
	                    return out;
	                };
	                this.set = function (idx, val) {
	                    var item = this.value[idx];
	                    if (!item) {
	                        item = this.value[idx] = vec2.create();
	                    }
	                    vec2Copy(item, val);
	                };
	                break;
	            case 3:
	                this.get = function (idx, out) {
	                    var item = this.value[idx];
	                    if (item) {
	                        vec3Copy(out, item);
	                    }
	                    return out;
	                };
	                this.set = function (idx, val) {
	                    var item = this.value[idx];
	                    if (!item) {
	                        item = this.value[idx] = vec3.create();
	                    }
	                    vec3Copy(item, val);
	                };
	                break;
	            case 4:
	                this.get = function (idx, out) {
	                    var item = this.value[idx];
	                    if (item) {
	                        vec4Copy(out, item);
	                    }
	                    return out;
	                };
	                this.set = function (idx, val) {
	                    var item = this.value[idx];
	                    if (!item) {
	                        item = this.value[idx] = vec4.create();
	                    }
	                    vec4Copy(item, val);
	                };
	                break;
	        }
	    }
	    DynamicAttribute.prototype.constructor = new Attribute();

	    DynamicAttribute.prototype.init = function (nVertex) {
	        console.warn('Dynamic geometry not support init method');
	    };

	    DynamicAttribute.prototype.fromArray = function (array) {
	        console.warn('Dynamic geometry not support fromArray method');
	    };

	    function AttributeBuffer(name, type, buffer, size, semantic) {
	        this.name = name;
	        this.type = type;
	        this.buffer = buffer;
	        this.size = size;
	        this.semantic = semantic;

	        // To be set in mesh
	        // symbol in the shader
	        this.symbol = '';
	    }

	    function IndicesBuffer(buffer) {
	        this.buffer = buffer;
	        this.count = 0;
	    }

	    function notImplementedWarn() {
	        console.warn('Geometry doesn\'t implement this method, use DynamicGeometry or StaticGeometry instead');
	    }

	    /**
	     * @constructor qtek.Geometry
	     * @extends qtek.core.Base
	     */
	    var Geometry = Base.extend(
	    /** @lends qtek.Geometry# */
	    {
	        /**
	         * @type {qtek.math.BoundingBox}
	         */
	        boundingBox : null,

	        /**
	         * Vertex attributes
	         * @type {Object}
	         */
	        attributes : {},

	        faces : null,

	        /**
	         * Is vertices data dynamically updated
	         * @type {boolean}
	         */
	        dynamic: false,

	        /**
	         * @type {boolean}
	         */
	        useFace: true

	    }, function() {
	        // Use cache
	        this._cache = new Cache();

	        this._attributeList = Object.keys(this.attributes);
	    },
	    /** @lends qtek.Geometry.prototype */
	    {
	        /**
	         * User defined ray picking algorithm instead of default
	         * triangle ray intersection
	         * @type {Function}
	         */
	        pickByRay: null,

	        /**
	         * Main attribute will be used to count vertex number
	         * @type {string}
	         */
	        mainAttribute: 'position',
	        /**
	         * Mark attributes in geometry is dirty
	         * @method
	         */
	        dirty: notImplementedWarn,
	        /**
	         * Create a new attribute
	         * @method
	         * @param {string} name
	         * @param {string} type
	         * @param {number} size
	         * @param {string} [semantic]
	         */
	        createAttribute: notImplementedWarn,
	        /**
	         * Remove attribute
	         * @method
	         * @param {string} name
	         */
	        removeAttribute: notImplementedWarn,

	        /**
	         * @method
	         * @param {number} idx
	         * @param {Array.<number>} out
	         * @return {Array.<number>}
	         */
	        getFace: notImplementedWarn,

	        /**
	         * @method
	         * @param {number} idx
	         * @param {Array.<number>} face
	         */
	        setFace: notImplementedWarn,
	        /**
	         * @method
	         * @return {boolean}
	         */
	        isUseFace: notImplementedWarn,

	        getEnabledAttributes: notImplementedWarn,
	        getBufferChunks: notImplementedWarn,

	        /**
	         * @method
	         */
	        generateVertexNormals: notImplementedWarn,
	        /**
	         * @method
	         */
	        generateFaceNormals: notImplementedWarn,
	        /**
	         * @method
	         * @return {boolean}
	         */
	        isUniqueVertex: notImplementedWarn,
	        /**
	         * @method
	         */
	        generateUniqueVertex: notImplementedWarn,
	        /**
	         * @method
	         */
	        generateTangents: notImplementedWarn,
	        /**
	         * @method
	         */
	        generateBarycentric: notImplementedWarn,
	        /**
	         * @method
	         * @param {qtek.math.Matrix4} matrix
	         */
	        applyTransform: notImplementedWarn,
	        /**
	         * @method
	         * @param {WebGLRenderingContext} [gl]
	         */
	        dispose: notImplementedWarn
	    });

	    Geometry.STATIC_DRAW = glenum.STATIC_DRAW;
	    Geometry.DYNAMIC_DRAW = glenum.DYNAMIC_DRAW;
	    Geometry.STREAM_DRAW = glenum.STREAM_DRAW;

	    Geometry.AttributeBuffer = AttributeBuffer;
	    Geometry.IndicesBuffer = IndicesBuffer;
	    Geometry.Attribute = Attribute;
	    Geometry.StaticAttribute = StaticAttribute;
	    Geometry.DynamicAttribute = DynamicAttribute;

	    module.exports = Geometry;


/***/ },
/* 32 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	/**
	 * StaticGeometry can not be changed once they've been setup
	 */


	    var Geometry = __webpack_require__(31);
	    var BoundingBox = __webpack_require__(13);
	    var glMatrix = __webpack_require__(15);
	    var vendor = __webpack_require__(12);
	    var glenum = __webpack_require__(11);
	    var mat4 = glMatrix.mat4;
	    var vec3 = glMatrix.vec3;

	    var StaticAttribute = Geometry.StaticAttribute;
	    var vec3Create = vec3.create;
	    var vec3Add = vec3.add;
	    var vec3Set = vec3.set;

	    /**
	     * @constructor qtek.StaticGeometry
	     * @extends qtek.Geometry
	     */
	    var StaticGeometry = Geometry.extend(function () {
	        return /** @lends qtek.StaticGeometry# */ {
	            attributes: {
	                 position: new StaticAttribute('position', 'float', 3, 'POSITION'),
	                 texcoord0: new StaticAttribute('texcoord0', 'float', 2, 'TEXCOORD_0'),
	                 texcoord1: new StaticAttribute('texcoord1', 'float', 2, 'TEXCOORD_1'),
	                 normal: new StaticAttribute('normal', 'float', 3, 'NORMAL'),
	                 tangent: new StaticAttribute('tangent', 'float', 4, 'TANGENT'),
	                 color: new StaticAttribute('color', 'float', 4, 'COLOR'),
	                 // Skinning attributes
	                 // Each vertex can be bind to 4 bones, because the
	                 // sum of weights is 1, so the weights is stored in vec3 and the last
	                 // can be calculated by 1-w.x-w.y-w.z
	                 weight: new StaticAttribute('weight', 'float', 3, 'WEIGHT'),
	                 joint: new StaticAttribute('joint', 'float', 4, 'JOINT'),
	                 // For wireframe display
	                 // http://codeflow.org/entries/2012/aug/02/easy-wireframe-display-with-barycentric-coordinates/
	                 barycentric: new StaticAttribute('barycentric', 'float', 3, null),
	            },

	            hint: glenum.STATIC_DRAW,

	            /**
	             * @type {Uint16Array}
	             */
	            faces: null,

	            _normalType: 'vertex',

	            _enabledAttributes: null
	        };
	    },
	    /** @lends qtek.StaticGeometry.prototype */
	    {
	        updateBoundingBox: function () {
	            var bbox = this.boundingBox;
	            if (!bbox) {
	                bbox = this.boundingBox = new BoundingBox();
	            }
	            var posArr = this.attributes.position.value;
	            if (posArr && posArr.length) {
	                var min = bbox.min;
	                var max = bbox.max;
	                var minArr = min._array;
	                var maxArr = max._array;
	                vec3.set(minArr, posArr[0], posArr[1], posArr[2]);
	                vec3.set(maxArr, posArr[0], posArr[1], posArr[2]);
	                for (var i = 3; i < posArr.length;) {
	                    var x = posArr[i++];
	                    var y = posArr[i++];
	                    var z = posArr[i++];
	                    if (x < minArr[0]) { minArr[0] = x; }
	                    if (y < minArr[1]) { minArr[1] = y; }
	                    if (z < minArr[2]) { minArr[2] = z; }

	                    if (x > maxArr[0]) { maxArr[0] = x; }
	                    if (y > maxArr[1]) { maxArr[1] = y; }
	                    if (z > maxArr[2]) { maxArr[2] = z; }
	                }
	                min._dirty = true;
	                max._dirty = true;
	            }
	        },

	        dirty: function () {
	            this._cache.dirtyAll();
	            this._enabledAttributes = null;
	        },

	        getFace: function (idx, out) {
	            if (idx < this.faceCount && idx >= 0) {
	                if (!out) {
	                    out = vec3Create();
	                }
	                var faces = this.faces;
	                out[0] = faces[idx * 3];
	                out[1] = faces[idx * 3 + 1];
	                out[2] = faces[idx * 3 + 2];
	                return out;
	            }
	        },

	        setFace: function (idx, arr) {
	            var faces = this.faces;
	            faces[idx * 3] = arr[0];
	            faces[idx * 3 + 1] = arr[1];
	            faces[idx * 3 + 2] = arr[2];
	        },

	        isUseFace: function () {
	            return this.useFace && (this.faces != null);
	        },

	        initFaceFromArray: function (array) {
	            var value;
	            var ArrayConstructor = this.vertexCount > 0xffff
	                ? vendor.Uint32Array : vendor.Uint16Array;
	            // Convert 2d array to flat
	            if (array[0] && (array[0].length)) {
	                var n = 0;
	                var size = 3;

	                value = new ArrayConstructor(array.length * size);
	                for (var i = 0; i < array.length; i++) {
	                    for (var j = 0; j < size; j++) {
	                        value[n++] = array[i][j];
	                    }
	                }
	            }
	            else {
	                value = new ArrayConstructor(array);
	            }

	            this.faces = value;
	        },

	        createAttribute: function (name, type, size, semantic) {
	            var attrib = new StaticAttribute(name, type, size, semantic);
	            if (this.attributes[name]) {
	                this.removeAttribute(name);
	            }
	            this.attributes[name] = attrib;
	            this._attributeList.push(name);
	            return attrib;
	        },

	        removeAttribute: function (name) {
	            var attributeList = this._attributeList;
	            var idx = attributeList.indexOf(name);
	            if (idx >= 0) {
	                attributeList.splice(idx, 1);
	                delete this.attributes[name];
	                return true;
	            }
	            return false;
	        },

	        /**
	         * Get enabled attributes name list
	         * Attribute which has the same vertex number with position is treated as a enabled attribute
	         * @return {string[]}
	         */
	        getEnabledAttributes: function () {
	            var enabledAttributes = this._enabledAttributes;
	            var attributeList = this._attributeList;
	            // Cache
	            if (enabledAttributes) {
	                return enabledAttributes;
	            }

	            var result = [];
	            var nVertex = this.vertexCount;

	            for (var i = 0; i < attributeList.length; i++) {
	                var name = attributeList[i];
	                var attrib = this.attributes[name];
	                if (attrib.value) {
	                    if (attrib.value.length === nVertex * attrib.size) {
	                        result.push(name);
	                    }
	                }
	            }

	            this._enabledAttributes = result;

	            return result;
	        },

	        getBufferChunks: function (_gl) {
	            var cache = this._cache;
	            cache.use(_gl.__GLID__);
	            if (cache.isDirty()) {
	                this._updateBuffer(_gl);
	                cache.fresh();
	            }
	            return cache.get('chunks');
	        },

	        _updateBuffer: function (_gl) {
	            var chunks = this._cache.get('chunks');
	            var firstUpdate = false;
	            if (!chunks) {
	                chunks = [];
	                // Intialize
	                chunks[0] = {
	                    attributeBuffers: [],
	                    indicesBuffer: null
	                };
	                this._cache.put('chunks', chunks);
	                firstUpdate = true;
	            }
	            var chunk = chunks[0];
	            var attributeBuffers = chunk.attributeBuffers;
	            var indicesBuffer = chunk.indicesBuffer;

	            var attributeList = this.getEnabledAttributes();
	            var prevSearchIdx = 0;
	            var count = 0;

	            // PENDING  If some attributes removed
	            for (var k = 0; k < attributeList.length; k++) {
	                var name = attributeList[k];
	                var attribute = this.attributes[name];

	                var bufferInfo;

	                if (!firstUpdate) {
	                    // Search for created buffer
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
	                }
	                else {
	                    buffer = _gl.createBuffer();
	                }
	                //TODO: Use BufferSubData?
	                _gl.bindBuffer(_gl.ARRAY_BUFFER, buffer);
	                _gl.bufferData(_gl.ARRAY_BUFFER, attribute.value, this.hint);

	                attributeBuffers[count++] = new Geometry.AttributeBuffer(name, attribute.type, buffer, attribute.size, attribute.semantic);
	            }
	            attributeBuffers.length = count;

	            if (this.isUseFace()) {
	                if (!indicesBuffer) {
	                    indicesBuffer = new Geometry.IndicesBuffer(_gl.createBuffer());
	                    chunk.indicesBuffer = indicesBuffer;
	                }
	                indicesBuffer.count = this.faces.length;
	                _gl.bindBuffer(_gl.ELEMENT_ARRAY_BUFFER, indicesBuffer.buffer);
	                _gl.bufferData(_gl.ELEMENT_ARRAY_BUFFER, this.faces, this.hint);
	            }
	        },

	        generateVertexNormals: function () {
	            var faces = this.faces;
	            var attributes = this.attributes;
	            var positions = attributes.position.value;
	            var normals = attributes.normal.value;

	            if (!normals || normals.length !== positions.length) {
	                normals = attributes.normal.value = new vendor.Float32Array(positions.length);
	            } else {
	                // Reset
	                for (var i = 0; i < normals.length; i++) {
	                    normals[i] = 0;
	                }
	            }

	            var p1 = vec3Create();
	            var p2 = vec3Create();
	            var p3 = vec3Create();

	            var v21 = vec3Create();
	            var v32 = vec3Create();

	            var n = vec3Create();

	            for (var f = 0; f < faces.length;) {
	                var i1 = faces[f++];
	                var i2 = faces[f++];
	                var i3 = faces[f++];

	                vec3Set(p1, positions[i1*3], positions[i1*3+1], positions[i1*3+2]);
	                vec3Set(p2, positions[i2*3], positions[i2*3+1], positions[i2*3+2]);
	                vec3Set(p3, positions[i3*3], positions[i3*3+1], positions[i3*3+2]);

	                vec3.sub(v21, p1, p2);
	                vec3.sub(v32, p2, p3);
	                vec3.cross(n, v21, v32);
	                // Weighted by the triangle area
	                for (var i = 0; i < 3; i++) {
	                    normals[i1*3+i] = normals[i1*3+i] + n[i];
	                    normals[i2*3+i] = normals[i2*3+i] + n[i];
	                    normals[i3*3+i] = normals[i3*3+i] + n[i];
	                }
	            }

	            for (var i = 0; i < normals.length;) {
	                vec3Set(n, normals[i], normals[i+1], normals[i+2]);
	                vec3.normalize(n, n);
	                normals[i++] = n[0];
	                normals[i++] = n[1];
	                normals[i++] = n[2];
	            }
	            this.dirty();
	        },

	        generateFaceNormals: function () {
	            if (!this.isUniqueVertex()) {
	                this.generateUniqueVertex();
	            }

	            var faces = this.faces;
	            var attributes = this.attributes;
	            var positions = attributes.position.value;
	            var normals = attributes.normal.value;

	            var p1 = vec3Create();
	            var p2 = vec3Create();
	            var p3 = vec3Create();

	            var v21 = vec3Create();
	            var v32 = vec3Create();
	            var n = vec3Create();

	            if (!normals) {
	                normals = attributes.normal.value = new Float32Array(positions.length);
	            }
	            for (var f = 0; f < faces.length;) {
	                var i1 = faces[f++];
	                var i2 = faces[f++];
	                var i3 = faces[f++];

	                vec3Set(p1, positions[i1*3], positions[i1*3+1], positions[i1*3+2]);
	                vec3Set(p2, positions[i2*3], positions[i2*3+1], positions[i2*3+2]);
	                vec3Set(p3, positions[i3*3], positions[i3*3+1], positions[i3*3+2]);

	                vec3.sub(v21, p1, p2);
	                vec3.sub(v32, p2, p3);
	                vec3.cross(n, v21, v32);

	                vec3.normalize(n, n);

	                for (var i = 0; i < 3; i++) {
	                    normals[i1*3 + i] = n[i];
	                    normals[i2*3 + i] = n[i];
	                    normals[i3*3 + i] = n[i];
	                }
	            }
	            this.dirty();
	        },

	        generateTangents: function () {
	            var nVertex = this.vertexCount;
	            var attributes = this.attributes;
	            if (!attributes.tangent.value) {
	                attributes.tangent.value = new Float32Array(nVertex * 4);
	            }
	            var texcoords = attributes.texcoord0.value;
	            var positions = attributes.position.value;
	            var tangents = attributes.tangent.value;
	            var normals = attributes.normal.value;

	            var tan1 = [];
	            var tan2 = [];
	            for (var i = 0; i < nVertex; i++) {
	                tan1[i] = [0.0, 0.0, 0.0];
	                tan2[i] = [0.0, 0.0, 0.0];
	            }

	            var sdir = [0.0, 0.0, 0.0];
	            var tdir = [0.0, 0.0, 0.0];
	            var faces = this.faces;
	            for (var i = 0; i < faces.length;) {
	                var i1 = faces[i++],
	                    i2 = faces[i++],
	                    i3 = faces[i++],

	                    st1s = texcoords[i1 * 2],
	                    st2s = texcoords[i2 * 2],
	                    st3s = texcoords[i3 * 2],
	                    st1t = texcoords[i1 * 2 + 1],
	                    st2t = texcoords[i2 * 2 + 1],
	                    st3t = texcoords[i3 * 2 + 1],

	                    p1x = positions[i1 * 3],
	                    p2x = positions[i2 * 3],
	                    p3x = positions[i3 * 3],
	                    p1y = positions[i1 * 3 + 1],
	                    p2y = positions[i2 * 3 + 1],
	                    p3y = positions[i3 * 3 + 1],
	                    p1z = positions[i1 * 3 + 2],
	                    p2z = positions[i2 * 3 + 2],
	                    p3z = positions[i3 * 3 + 2];

	                var x1 = p2x - p1x,
	                    x2 = p3x - p1x,
	                    y1 = p2y - p1y,
	                    y2 = p3y - p1y,
	                    z1 = p2z - p1z,
	                    z2 = p3z - p1z;

	                var s1 = st2s - st1s,
	                    s2 = st3s - st1s,
	                    t1 = st2t - st1t,
	                    t2 = st3t - st1t;

	                var r = 1.0 / (s1 * t2 - t1 * s2);
	                sdir[0] = (t2 * x1 - t1 * x2) * r;
	                sdir[1] = (t2 * y1 - t1 * y2) * r;
	                sdir[2] = (t2 * z1 - t1 * z2) * r;

	                tdir[0] = (s1 * x2 - s2 * x1) * r;
	                tdir[1] = (s1 * y2 - s2 * y1) * r;
	                tdir[2] = (s1 * z2 - s2 * z1) * r;

	                vec3Add(tan1[i1], tan1[i1], sdir);
	                vec3Add(tan1[i2], tan1[i2], sdir);
	                vec3Add(tan1[i3], tan1[i3], sdir);
	                vec3Add(tan2[i1], tan2[i1], tdir);
	                vec3Add(tan2[i2], tan2[i2], tdir);
	                vec3Add(tan2[i3], tan2[i3], tdir);
	            }
	            var tmp = vec3Create();
	            var nCrossT = vec3Create();
	            var n = vec3Create();
	            for (var i = 0; i < nVertex; i++) {
	                n[0] = normals[i * 3];
	                n[1] = normals[i * 3 + 1];
	                n[2] = normals[i * 3 + 2];
	                var t = tan1[i];

	                // Gram-Schmidt orthogonalize
	                vec3.scale(tmp, n, vec3.dot(n, t));
	                vec3.sub(tmp, t, tmp);
	                vec3.normalize(tmp, tmp);
	                // Calculate handedness.
	                vec3.cross(nCrossT, n, t);
	                tangents[i * 4] = tmp[0];
	                tangents[i * 4 + 1] = tmp[1];
	                tangents[i * 4 + 2] = tmp[2];
	                tangents[i * 4 + 3] = vec3.dot(nCrossT, tan2[i]) < 0.0 ? -1.0 : 1.0;
	            }
	            this.dirty();
	        },

	        isUniqueVertex: function () {
	            if (this.isUseFace()) {
	                return this.vertexCount === this.faces.length;
	            } else {
	                return true;
	            }
	        },

	        generateUniqueVertex: function () {
	            var vertexUseCount = [];

	            for (var i = 0, len = this.vertexCount; i < len; i++) {
	                vertexUseCount[i] = 0;
	            }
	            if (this.faces.length > 0xffff) {
	                this.faces = new vendor.Uint32Array(this.faces);
	            }

	            var cursor = 0;
	            var attributes = this.attributes;
	            var faces = this.faces;

	            // Cursor not use vertexNumber in case vertex array length is larger than face used.
	            for (var i = 0; i < faces.length; i++) {
	                cursor = Math.max(cursor, faces[i] + 1);
	            }

	            var attributeNameList = this.getEnabledAttributes();

	            for (var a = 0; a < attributeNameList.length; a++) {
	                var name = attributeNameList[a];
	                var valueArr = attributes[name].value;
	                attributes[name].init(this.faces.length);
	                var expandedArray = attributes[name].value;
	                for (var i = 0; i < valueArr.length; i++) {
	                    expandedArray[i] = valueArr[i];
	                }
	            }

	            for (var i = 0; i < faces.length; i++) {
	                var ii = faces[i];
	                if (vertexUseCount[ii] > 0) {
	                    for (var a = 0; a < attributeNameList.length; a++) {
	                        var name = attributeNameList[a];
	                        var array = attributes[name].value;
	                        var size = attributes[name].size;

	                        for (var k = 0; k < size; k++) {
	                            array[cursor * size + k] = array[ii * size + k];
	                        }
	                    }
	                    faces[i] = cursor;
	                    cursor++;
	                }
	                vertexUseCount[ii]++;
	            }

	            this.dirty();
	        },

	        generateBarycentric: function () {

	            if (!this.isUniqueVertex()) {
	                this.generateUniqueVertex();
	            }

	            var attributes = this.attributes;
	            var array = attributes.barycentric.value;
	            var faces = this.faces;
	            // Already existed;
	            if (array && array.length === faces.length * 3) {
	                return;
	            }
	            array = attributes.barycentric.value = new Float32Array(faces.length * 3);
	            for (var i = 0; i < faces.length;) {
	                for (var j = 0; j < 3; j++) {
	                    var ii = faces[i++];
	                    array[ii * 3 + j] = 1;
	                }
	            }
	            this.dirty();
	        },

	        convertToDynamic: function (geometry) {
	            for (var i = 0; i < this.faces.length; i+=3) {
	                geometry.faces.push(this.face.subarray(i, i + 3));
	            }

	            var attributes = this.getEnabledAttributes();
	            for (var name in attributes) {
	                var attrib = attributes[name];
	                var geoAttrib = geometry.attributes[name];
	                if (!geoAttrib) {
	                    geoAttrib = geometry.attributes[name] = {
	                        type: attrib.type,
	                        size: attrib.size,
	                        value: []
	                    };
	                    if (attrib.semantic) {
	                        geoAttrib.semantic = attrib.semantic;
	                    }
	                }
	                for (var i = 0; i < attrib.value.length; i+= attrib.size) {
	                    if (attrib.size === 1) {
	                        geoAttrib.value.push(attrib.array[i]);
	                    } else {
	                        geoAttrib.value.push(attrib.subarray(i, i + attrib.size));
	                    }
	                }
	            }

	            if (this.boundingBox) {
	                geometry.boundingBox = new BoundingBox();
	                geometry.boundingBox.min.copy(this.boundingBox.min);
	                geometry.boundingBox.max.copy(this.boundingBox.max);
	            }
	            // PENDING copy buffer ?

	            return geometry;
	        },

	        applyTransform: function (matrix) {

	            var attributes = this.attributes;
	            var positions = attributes.position.value;
	            var normals = attributes.normal.value;
	            var tangents = attributes.tangent.value;

	            matrix = matrix._array;
	            // Normal Matrix
	            var inverseTransposeMatrix = mat4.create();
	            mat4.invert(inverseTransposeMatrix, matrix);
	            mat4.transpose(inverseTransposeMatrix, inverseTransposeMatrix);

	            var vec3TransformMat4 = vec3.transformMat4;
	            var vec3ForEach = vec3.forEach;
	            vec3ForEach(positions, 3, 0, null, vec3TransformMat4, matrix);
	            if (normals) {
	                vec3ForEach(normals, 3, 0, null, vec3TransformMat4, inverseTransposeMatrix);
	            }
	            if (tangents) {
	                vec3ForEach(tangents, 4, 0, null, vec3TransformMat4, inverseTransposeMatrix);
	            }

	            if (this.boundingBox) {
	                this.updateBoundingBox();
	            }
	        },

	        dispose: function (_gl) {

	            var cache = this._cache;

	            cache.use(_gl.__GLID__);
	            var chunks = cache.get('chunks');
	            if (chunks) {
	                for (var c = 0; c < chunks.length; c++) {
	                    var chunk = chunks[c];

	                    for (var k = 0; k < chunk.attributeBuffers.length; k++) {
	                        var attribs = chunk.attributeBuffers[k];
	                        _gl.deleteBuffer(attribs.buffer);
	                    }
	                }
	            }
	            cache.deleteContext(_gl.__GLID__);
	        }
	    });

	    if (Object.defineProperty) {
	        Object.defineProperty(StaticGeometry.prototype, 'vertexCount', {

	            enumerable: false,

	            get: function () {
	                var mainAttribute = this.attributes[this.mainAttribute];
	                if (!mainAttribute || !mainAttribute.value) {
	                    return 0;
	                }
	                return mainAttribute.value.length / mainAttribute.size;
	            }
	        });
	        Object.defineProperty(StaticGeometry.prototype, 'faceCount', {

	            enumerable: false,

	            get: function () {
	                var faces = this.faces;
	                if (!faces) {
	                    return 0;
	                }
	                else {
	                    return faces.length / 3;
	                }
	            }
	        });
	    }

	    StaticGeometry.Attribute = Geometry.StaticAttribute;

	    module.exports = StaticGeometry;


/***/ },
/* 33 */
/***/ function(module, exports) {

	/**
	 * 事件扩展
	 * @module zrender/mixin/Eventful
	 * @author Kener (@Kener-林峰, kener.linfeng@gmail.com)
	 *         pissang (https://www.github.com/pissang)
	 */


	    var arrySlice = Array.prototype.slice;

	    /**
	     * 事件分发器
	     * @alias module:zrender/mixin/Eventful
	     * @constructor
	     */
	    var Eventful = function () {
	        this._$handlers = {};
	    };

	    Eventful.prototype = {

	        constructor: Eventful,

	        /**
	         * 单次触发绑定，trigger后销毁
	         *
	         * @param {string} event 事件名
	         * @param {Function} handler 响应函数
	         * @param {Object} context
	         */
	        one: function (event, handler, context) {
	            var _h = this._$handlers;

	            if (!handler || !event) {
	                return this;
	            }

	            if (!_h[event]) {
	                _h[event] = [];
	            }

	            for (var i = 0; i < _h[event].length; i++) {
	                if (_h[event][i].h === handler) {
	                    return this;
	                }
	            }

	            _h[event].push({
	                h: handler,
	                one: true,
	                ctx: context || this
	            });

	            return this;
	        },

	        /**
	         * 绑定事件
	         * @param {string} event 事件名
	         * @param {Function} handler 事件处理函数
	         * @param {Object} [context]
	         */
	        on: function (event, handler, context) {
	            var _h = this._$handlers;

	            if (!handler || !event) {
	                return this;
	            }

	            if (!_h[event]) {
	                _h[event] = [];
	            }

	            for (var i = 0; i < _h[event].length; i++) {
	                if (_h[event][i].h === handler) {
	                    return this;
	                }
	            }

	            _h[event].push({
	                h: handler,
	                one: false,
	                ctx: context || this
	            });

	            return this;
	        },

	        /**
	         * 是否绑定了事件
	         * @param  {string}  event
	         * @return {boolean}
	         */
	        isSilent: function (event) {
	            var _h = this._$handlers;
	            return _h[event] && _h[event].length;
	        },

	        /**
	         * 解绑事件
	         * @param {string} event 事件名
	         * @param {Function} [handler] 事件处理函数
	         */
	        off: function (event, handler) {
	            var _h = this._$handlers;

	            if (!event) {
	                this._$handlers = {};
	                return this;
	            }

	            if (handler) {
	                if (_h[event]) {
	                    var newList = [];
	                    for (var i = 0, l = _h[event].length; i < l; i++) {
	                        if (_h[event][i]['h'] != handler) {
	                            newList.push(_h[event][i]);
	                        }
	                    }
	                    _h[event] = newList;
	                }

	                if (_h[event] && _h[event].length === 0) {
	                    delete _h[event];
	                }
	            }
	            else {
	                delete _h[event];
	            }

	            return this;
	        },

	        /**
	         * 事件分发
	         *
	         * @param {string} type 事件类型
	         */
	        trigger: function (type) {
	            if (this._$handlers[type]) {
	                var args = arguments;
	                var argLen = args.length;

	                if (argLen > 3) {
	                    args = arrySlice.call(args, 1);
	                }

	                var _h = this._$handlers[type];
	                var len = _h.length;
	                for (var i = 0; i < len;) {
	                    // Optimize advise from backbone
	                    switch (argLen) {
	                        case 1:
	                            _h[i]['h'].call(_h[i]['ctx']);
	                            break;
	                        case 2:
	                            _h[i]['h'].call(_h[i]['ctx'], args[1]);
	                            break;
	                        case 3:
	                            _h[i]['h'].call(_h[i]['ctx'], args[1], args[2]);
	                            break;
	                        default:
	                            // have more than 2 given arguments
	                            _h[i]['h'].apply(_h[i]['ctx'], args);
	                            break;
	                    }

	                    if (_h[i]['one']) {
	                        _h.splice(i, 1);
	                        len--;
	                    }
	                    else {
	                        i++;
	                    }
	                }
	            }

	            return this;
	        },

	        /**
	         * 带有context的事件分发, 最后一个参数是事件回调的context
	         * @param {string} type 事件类型
	         */
	        triggerWithContext: function (type) {
	            if (this._$handlers[type]) {
	                var args = arguments;
	                var argLen = args.length;

	                if (argLen > 4) {
	                    args = arrySlice.call(args, 1, args.length - 1);
	                }
	                var ctx = args[args.length - 1];

	                var _h = this._$handlers[type];
	                var len = _h.length;
	                for (var i = 0; i < len;) {
	                    // Optimize advise from backbone
	                    switch (argLen) {
	                        case 1:
	                            _h[i]['h'].call(ctx);
	                            break;
	                        case 2:
	                            _h[i]['h'].call(ctx, args[1]);
	                            break;
	                        case 3:
	                            _h[i]['h'].call(ctx, args[1], args[2]);
	                            break;
	                        default:
	                            // have more than 2 given arguments
	                            _h[i]['h'].apply(ctx, args);
	                            break;
	                    }

	                    if (_h[i]['one']) {
	                        _h.splice(i, 1);
	                        len--;
	                    }
	                    else {
	                        i++;
	                    }
	                }
	            }

	            return this;
	        }
	    };

	    // 对象可以通过 onxxxx 绑定事件
	    /**
	     * @event module:zrender/mixin/Eventful#onclick
	     * @type {Function}
	     * @default null
	     */
	    /**
	     * @event module:zrender/mixin/Eventful#onmouseover
	     * @type {Function}
	     * @default null
	     */
	    /**
	     * @event module:zrender/mixin/Eventful#onmouseout
	     * @type {Function}
	     * @default null
	     */
	    /**
	     * @event module:zrender/mixin/Eventful#onmousemove
	     * @type {Function}
	     * @default null
	     */
	    /**
	     * @event module:zrender/mixin/Eventful#onmousewheel
	     * @type {Function}
	     * @default null
	     */
	    /**
	     * @event module:zrender/mixin/Eventful#onmousedown
	     * @type {Function}
	     * @default null
	     */
	    /**
	     * @event module:zrender/mixin/Eventful#onmouseup
	     * @type {Function}
	     * @default null
	     */
	    /**
	     * @event module:zrender/mixin/Eventful#ondrag
	     * @type {Function}
	     * @default null
	     */
	    /**
	     * @event module:zrender/mixin/Eventful#ondragstart
	     * @type {Function}
	     * @default null
	     */
	    /**
	     * @event module:zrender/mixin/Eventful#ondragend
	     * @type {Function}
	     * @default null
	     */
	    /**
	     * @event module:zrender/mixin/Eventful#ondragenter
	     * @type {Function}
	     * @default null
	     */
	    /**
	     * @event module:zrender/mixin/Eventful#ondragleave
	     * @type {Function}
	     * @default null
	     */
	    /**
	     * @event module:zrender/mixin/Eventful#ondragover
	     * @type {Function}
	     * @default null
	     */
	    /**
	     * @event module:zrender/mixin/Eventful#ondrop
	     * @type {Function}
	     * @default null
	     */

	    module.exports = Eventful;



/***/ },
/* 34 */
/***/ function(module, exports) {

	/**
	 * @module zrender/core/util
	 */


	    // 用于处理merge时无法遍历Date等对象的问题
	    var BUILTIN_OBJECT = {
	        '[object Function]': 1,
	        '[object RegExp]': 1,
	        '[object Date]': 1,
	        '[object Error]': 1,
	        '[object CanvasGradient]': 1,
	        '[object CanvasPattern]': 1,
	        // For node-canvas
	        '[object Image]': 1,
	        '[object Canvas]': 1
	    };

	    var TYPED_ARRAY = {
	        '[object Int8Array]': 1,
	        '[object Uint8Array]': 1,
	        '[object Uint8ClampedArray]': 1,
	        '[object Int16Array]': 1,
	        '[object Uint16Array]': 1,
	        '[object Int32Array]': 1,
	        '[object Uint32Array]': 1,
	        '[object Float32Array]': 1,
	        '[object Float64Array]': 1
	    };

	    var objToString = Object.prototype.toString;

	    var arrayProto = Array.prototype;
	    var nativeForEach = arrayProto.forEach;
	    var nativeFilter = arrayProto.filter;
	    var nativeSlice = arrayProto.slice;
	    var nativeMap = arrayProto.map;
	    var nativeReduce = arrayProto.reduce;

	    /**
	     * Those data types can be cloned:
	     *     Plain object, Array, TypedArray, number, string, null, undefined.
	     * Those data types will be assgined using the orginal data:
	     *     BUILTIN_OBJECT
	     * Instance of user defined class will be cloned to a plain object, without
	     * properties in prototype.
	     * Other data types is not supported (not sure what will happen).
	     *
	     * Caution: do not support clone Date, for performance consideration.
	     * (There might be a large number of date in `series.data`).
	     * So date should not be modified in and out of echarts.
	     *
	     * @param {*} source
	     * @return {*} new
	     */
	    function clone(source) {
	        if (source == null || typeof source != 'object') {
	            return source;
	        }

	        var result = source;
	        var typeStr = objToString.call(source);

	        if (typeStr === '[object Array]') {
	            result = [];
	            for (var i = 0, len = source.length; i < len; i++) {
	                result[i] = clone(source[i]);
	            }
	        }
	        else if (TYPED_ARRAY[typeStr]) {
	            result = source.constructor.from(source);
	        }
	        else if (!BUILTIN_OBJECT[typeStr] && !isDom(source)) {
	            result = {};
	            for (var key in source) {
	                if (source.hasOwnProperty(key)) {
	                    result[key] = clone(source[key]);
	                }
	            }
	        }

	        return result;
	    }

	    /**
	     * @memberOf module:zrender/core/util
	     * @param {*} target
	     * @param {*} source
	     * @param {boolean} [overwrite=false]
	     */
	    function merge(target, source, overwrite) {
	        // We should escapse that source is string
	        // and enter for ... in ...
	        if (!isObject(source) || !isObject(target)) {
	            return overwrite ? clone(source) : target;
	        }

	        for (var key in source) {
	            if (source.hasOwnProperty(key)) {
	                var targetProp = target[key];
	                var sourceProp = source[key];

	                if (isObject(sourceProp)
	                    && isObject(targetProp)
	                    && !isArray(sourceProp)
	                    && !isArray(targetProp)
	                    && !isDom(sourceProp)
	                    && !isDom(targetProp)
	                    && !isBuiltInObject(sourceProp)
	                    && !isBuiltInObject(targetProp)
	                ) {
	                    // 如果需要递归覆盖，就递归调用merge
	                    merge(targetProp, sourceProp, overwrite);
	                }
	                else if (overwrite || !(key in target)) {
	                    // 否则只处理overwrite为true，或者在目标对象中没有此属性的情况
	                    // NOTE，在 target[key] 不存在的时候也是直接覆盖
	                    target[key] = clone(source[key], true);
	                }
	            }
	        }

	        return target;
	    }

	    /**
	     * @param {Array} targetAndSources The first item is target, and the rests are source.
	     * @param {boolean} [overwrite=false]
	     * @return {*} target
	     */
	    function mergeAll(targetAndSources, overwrite) {
	        var result = targetAndSources[0];
	        for (var i = 1, len = targetAndSources.length; i < len; i++) {
	            result = merge(result, targetAndSources[i], overwrite);
	        }
	        return result;
	    }

	    /**
	     * @param {*} target
	     * @param {*} source
	     * @memberOf module:zrender/core/util
	     */
	    function extend(target, source) {
	        for (var key in source) {
	            if (source.hasOwnProperty(key)) {
	                target[key] = source[key];
	            }
	        }
	        return target;
	    }

	    /**
	     * @param {*} target
	     * @param {*} source
	     * @param {boolen} [overlay=false]
	     * @memberOf module:zrender/core/util
	     */
	    function defaults(target, source, overlay) {
	        for (var key in source) {
	            if (source.hasOwnProperty(key)
	                && (overlay ? source[key] != null : target[key] == null)
	            ) {
	                target[key] = source[key];
	            }
	        }
	        return target;
	    }

	    function createCanvas() {
	        return document.createElement('canvas');
	    }
	    // FIXME
	    var _ctx;
	    function getContext() {
	        if (!_ctx) {
	            // Use util.createCanvas instead of createCanvas
	            // because createCanvas may be overwritten in different environment
	            _ctx = util.createCanvas().getContext('2d');
	        }
	        return _ctx;
	    }

	    /**
	     * 查询数组中元素的index
	     * @memberOf module:zrender/core/util
	     */
	    function indexOf(array, value) {
	        if (array) {
	            if (array.indexOf) {
	                return array.indexOf(value);
	            }
	            for (var i = 0, len = array.length; i < len; i++) {
	                if (array[i] === value) {
	                    return i;
	                }
	            }
	        }
	        return -1;
	    }

	    /**
	     * 构造类继承关系
	     *
	     * @memberOf module:zrender/core/util
	     * @param {Function} clazz 源类
	     * @param {Function} baseClazz 基类
	     */
	    function inherits(clazz, baseClazz) {
	        var clazzPrototype = clazz.prototype;
	        function F() {}
	        F.prototype = baseClazz.prototype;
	        clazz.prototype = new F();

	        for (var prop in clazzPrototype) {
	            clazz.prototype[prop] = clazzPrototype[prop];
	        }
	        clazz.prototype.constructor = clazz;
	        clazz.superClass = baseClazz;
	    }

	    /**
	     * @memberOf module:zrender/core/util
	     * @param {Object|Function} target
	     * @param {Object|Function} sorce
	     * @param {boolean} overlay
	     */
	    function mixin(target, source, overlay) {
	        target = 'prototype' in target ? target.prototype : target;
	        source = 'prototype' in source ? source.prototype : source;

	        defaults(target, source, overlay);
	    }

	    /**
	     * @param {Array|TypedArray} data
	     */
	    function isArrayLike(data) {
	        if (! data) {
	            return;
	        }
	        if (typeof data == 'string') {
	            return false;
	        }
	        return typeof data.length == 'number';
	    }

	    /**
	     * 数组或对象遍历
	     * @memberOf module:zrender/core/util
	     * @param {Object|Array} obj
	     * @param {Function} cb
	     * @param {*} [context]
	     */
	    function each(obj, cb, context) {
	        if (!(obj && cb)) {
	            return;
	        }
	        if (obj.forEach && obj.forEach === nativeForEach) {
	            obj.forEach(cb, context);
	        }
	        else if (obj.length === +obj.length) {
	            for (var i = 0, len = obj.length; i < len; i++) {
	                cb.call(context, obj[i], i, obj);
	            }
	        }
	        else {
	            for (var key in obj) {
	                if (obj.hasOwnProperty(key)) {
	                    cb.call(context, obj[key], key, obj);
	                }
	            }
	        }
	    }

	    /**
	     * 数组映射
	     * @memberOf module:zrender/core/util
	     * @param {Array} obj
	     * @param {Function} cb
	     * @param {*} [context]
	     * @return {Array}
	     */
	    function map(obj, cb, context) {
	        if (!(obj && cb)) {
	            return;
	        }
	        if (obj.map && obj.map === nativeMap) {
	            return obj.map(cb, context);
	        }
	        else {
	            var result = [];
	            for (var i = 0, len = obj.length; i < len; i++) {
	                result.push(cb.call(context, obj[i], i, obj));
	            }
	            return result;
	        }
	    }

	    /**
	     * @memberOf module:zrender/core/util
	     * @param {Array} obj
	     * @param {Function} cb
	     * @param {Object} [memo]
	     * @param {*} [context]
	     * @return {Array}
	     */
	    function reduce(obj, cb, memo, context) {
	        if (!(obj && cb)) {
	            return;
	        }
	        if (obj.reduce && obj.reduce === nativeReduce) {
	            return obj.reduce(cb, memo, context);
	        }
	        else {
	            for (var i = 0, len = obj.length; i < len; i++) {
	                memo = cb.call(context, memo, obj[i], i, obj);
	            }
	            return memo;
	        }
	    }

	    /**
	     * 数组过滤
	     * @memberOf module:zrender/core/util
	     * @param {Array} obj
	     * @param {Function} cb
	     * @param {*} [context]
	     * @return {Array}
	     */
	    function filter(obj, cb, context) {
	        if (!(obj && cb)) {
	            return;
	        }
	        if (obj.filter && obj.filter === nativeFilter) {
	            return obj.filter(cb, context);
	        }
	        else {
	            var result = [];
	            for (var i = 0, len = obj.length; i < len; i++) {
	                if (cb.call(context, obj[i], i, obj)) {
	                    result.push(obj[i]);
	                }
	            }
	            return result;
	        }
	    }

	    /**
	     * 数组项查找
	     * @memberOf module:zrender/core/util
	     * @param {Array} obj
	     * @param {Function} cb
	     * @param {*} [context]
	     * @return {Array}
	     */
	    function find(obj, cb, context) {
	        if (!(obj && cb)) {
	            return;
	        }
	        for (var i = 0, len = obj.length; i < len; i++) {
	            if (cb.call(context, obj[i], i, obj)) {
	                return obj[i];
	            }
	        }
	    }

	    /**
	     * @memberOf module:zrender/core/util
	     * @param {Function} func
	     * @param {*} context
	     * @return {Function}
	     */
	    function bind(func, context) {
	        var args = nativeSlice.call(arguments, 2);
	        return function () {
	            return func.apply(context, args.concat(nativeSlice.call(arguments)));
	        };
	    }

	    /**
	     * @memberOf module:zrender/core/util
	     * @param {Function} func
	     * @return {Function}
	     */
	    function curry(func) {
	        var args = nativeSlice.call(arguments, 1);
	        return function () {
	            return func.apply(this, args.concat(nativeSlice.call(arguments)));
	        };
	    }

	    /**
	     * @memberOf module:zrender/core/util
	     * @param {*} value
	     * @return {boolean}
	     */
	    function isArray(value) {
	        return objToString.call(value) === '[object Array]';
	    }

	    /**
	     * @memberOf module:zrender/core/util
	     * @param {*} value
	     * @return {boolean}
	     */
	    function isFunction(value) {
	        return typeof value === 'function';
	    }

	    /**
	     * @memberOf module:zrender/core/util
	     * @param {*} value
	     * @return {boolean}
	     */
	    function isString(value) {
	        return objToString.call(value) === '[object String]';
	    }

	    /**
	     * @memberOf module:zrender/core/util
	     * @param {*} value
	     * @return {boolean}
	     */
	    function isObject(value) {
	        // Avoid a V8 JIT bug in Chrome 19-20.
	        // See https://code.google.com/p/v8/issues/detail?id=2291 for more details.
	        var type = typeof value;
	        return type === 'function' || (!!value && type == 'object');
	    }

	    /**
	     * @memberOf module:zrender/core/util
	     * @param {*} value
	     * @return {boolean}
	     */
	    function isBuiltInObject(value) {
	        return !!BUILTIN_OBJECT[objToString.call(value)];
	    }

	    /**
	     * @memberOf module:zrender/core/util
	     * @param {*} value
	     * @return {boolean}
	     */
	    function isDom(value) {
	        return typeof value === 'object'
	            && typeof value.nodeType === 'number'
	            && typeof value.ownerDocument === 'object';
	    }

	    /**
	     * Whether is exactly NaN. Notice isNaN('a') returns true.
	     * @param {*} value
	     * @return {boolean}
	     */
	    function eqNaN(value) {
	        return value !== value;
	    }

	    /**
	     * If value1 is not null, then return value1, otherwise judget rest of values.
	     * @memberOf module:zrender/core/util
	     * @return {*} Final value
	     */
	    function retrieve(values) {
	        for (var i = 0, len = arguments.length; i < len; i++) {
	            if (arguments[i] != null) {
	                return arguments[i];
	            }
	        }
	    }

	    /**
	     * @memberOf module:zrender/core/util
	     * @param {Array} arr
	     * @param {number} startIndex
	     * @param {number} endIndex
	     * @return {Array}
	     */
	    function slice() {
	        return Function.call.apply(nativeSlice, arguments);
	    }

	    /**
	     * @memberOf module:zrender/core/util
	     * @param {boolean} condition
	     * @param {string} message
	     */
	    function assert(condition, message) {
	        if (!condition) {
	            throw new Error(message);
	        }
	    }

	    var util = {
	        inherits: inherits,
	        mixin: mixin,
	        clone: clone,
	        merge: merge,
	        mergeAll: mergeAll,
	        extend: extend,
	        defaults: defaults,
	        getContext: getContext,
	        createCanvas: createCanvas,
	        indexOf: indexOf,
	        slice: slice,
	        find: find,
	        isArrayLike: isArrayLike,
	        each: each,
	        map: map,
	        reduce: reduce,
	        filter: filter,
	        bind: bind,
	        curry: curry,
	        isArray: isArray,
	        isString: isString,
	        isObject: isObject,
	        isFunction: isFunction,
	        isBuiltInObject: isBuiltInObject,
	        isDom: isDom,
	        eqNaN: eqNaN,
	        retrieve: retrieve,
	        assert: assert,
	        noop: function () {}
	    };
	    module.exports = util;



/***/ },
/* 35 */
/***/ function(module, exports, __webpack_require__) {

	var echarts = __webpack_require__(2);


/***/ },
/* 36 */
/***/ function(module, exports, __webpack_require__) {

	var echarts = __webpack_require__(2);

	__webpack_require__(37);
	__webpack_require__(38);

	__webpack_require__(68);

	echarts.registerAction({
	    type: 'globeUpdateCamera',
	    event: 'globeupdatecamera',
	    update: 'none'
	}, function (payload, ecModel) {
	    ecModel.eachComponent({
	        mainType: 'globe', query: payload
	    }, function (componentModel) {
	        componentModel.setView(payload.position, payload.quaternion);
	    });
	});

/***/ },
/* 37 */
/***/ function(module, exports, __webpack_require__) {

	var echarts = __webpack_require__(2);

	module.exports = echarts.extendComponentModel({

	    type: 'globe',

	    layoutMode: 'box',

	    coordinateSystem: null,

	    defaultOption: {

	        zlevel: 10,

	        show: true,

	        flat: false,

	        // Layout used for viewport
	        left: 0,
	        top: 0,
	        width: '100%',
	        height: '100%',

	        environmentTexture: '',

	        // Base albedo texture
	        baseTexture: '',

	        // Height texture for bump mapping and vertex displacement
	        heightTexture: '',

	        // Texture for vertex displacement, default use heightTexture
	        displacementTexture: '',
	        // Scale of vertex displacement, available only if displacementTexture is set.
	        displacementScale: 0,

	        globeRadius: 100,

	        // Shading of globe
	        // 'color', 'lambert'
	        // TODO, 'realastic', 'toon'
	        shading: 'color',

	        // Light is available when material.shading is not color
	        light: {
	            sunIntensity: 1,

	            ambientIntensity: 0.1,

	            // Time, default it will use system time
	            time: ''
	        },

	        // Configuration abount view control
	        viewControl: {
	            // If rotate on on init
	            autoRotate: true,

	            // Start rotating after still for a given time
	            // default is 3 seconds
	            autoRotateAfterStill: 3,

	            // Rotate globe or pan flat map to have camera centered on given coord
	            center: null,

	            // Distance to the surface of globe.
	            distance: 150,

	            // Min distance to the surface of globe
	            minDistance: 40,
	            // Max distance to the surface of globe
	            maxDistance: 400,

	            // Position and quaternion of camera, override all other properties
	            position: null,
	            quaternion: null
	        },

	        layers: []
	    },

	    setView: function (position, quaternion) {
	        this.option.viewControl.position = position;
	        this.option.viewControl.quaternion = quaternion;
	    }
	});

/***/ },
/* 38 */
/***/ function(module, exports, __webpack_require__) {

	var echarts = __webpack_require__(2);

	var graphicGL = __webpack_require__(39);
	var OrbitControl = __webpack_require__(64);

	var sunCalc = __webpack_require__(65);

	function createBlankCanvas() {
	    var canvas = document.createElement('canvas');
	    var ctx = canvas.getContext('2d');
	    canvas.width = canvas.height = 1;
	    ctx.fillStyle = '#fff';
	    ctx.fillRect(0, 0, 1, 1);

	    return ctx;
	}


	graphicGL.Shader.import(__webpack_require__(66));
	graphicGL.Shader.import(__webpack_require__(67));

	module.exports = echarts.extendComponentView({

	    type: 'globe',

	    _displacementScale: 0,

	    init: function (ecModel, api) {
	        this.groupGL = new graphicGL.Node();

	        this._blankTexture = new graphicGL.Texture2D({
	            image: createBlankCanvas()
	        });
	        /**
	         * @type {qtek.Shader}
	         * @private
	         */
	        var lambertShader = new graphicGL.Shader({
	            vertex: graphicGL.Shader.source('ecgl.lambert.vertex'),
	            fragment: graphicGL.Shader.source('ecgl.lambert.fragment')
	        });
	        this._lambertMaterial = new graphicGL.Material({
	            shader: lambertShader
	        });

	        /**
	         * @type {qtek.Shader}
	         * @private
	         */
	        var albedoShader = new graphicGL.Shader({
	            vertex: graphicGL.Shader.source('ecgl.albedo.vertex'),
	            fragment: graphicGL.Shader.source('ecgl.albedo.fragment')
	        });
	        this._albedoMaterial = new graphicGL.Material({
	            shader: albedoShader
	        });

	        /**
	         * @type {qtek.geometry.Sphere}
	         * @private
	         */
	        this._sphereGeometry = new graphicGL.SphereGeometry({
	            widthSegments: 200,
	            heightSegments: 100,
	            dynamic: true
	        });

	        /**
	         * @type {qtek.geometry.Plane}
	         */
	        this._planeGeometry = new graphicGL.PlaneGeometry();

	        /**
	         * @type {qtek.geometry.Mesh}
	         */
	        this._earthMesh = new graphicGL.Mesh({
	            name: 'earth'
	        });

	        /**
	         * @type {qtek.light.Directional}
	         */
	        this._sunLight = new graphicGL.DirectionalLight();

	        /**
	         * @type {qtek.light.Ambient}
	         */
	        this._ambientLight = new graphicGL.AmbientLight();

	        this.groupGL.add(this._earthMesh);
	        this.groupGL.add(this._ambientLight);
	        this.groupGL.add(this._sunLight);

	        this._control = new OrbitControl({
	            zr: api.getZr()
	        });

	        this._control.init();
	    },

	    render: function (globeModel, ecModel, api) {
	        var coordSys = globeModel.coordinateSystem;
	        var shading = globeModel.get('shading');

	        // Add self to scene;
	        coordSys.viewGL.add(this.groupGL);

	        var earthMesh = this._earthMesh;

	        earthMesh.geometry = this._sphereGeometry;

	        if (shading === 'color') {
	            earthMesh.material = this._albedoMaterial;
	        }
	        else if (shading === 'lambert') {
	            earthMesh.material = this._lambertMaterial;
	        }
	        else {
	            console.warn('Unkonw shading ' + shading);
	            earthMesh.material = this._albedoMaterial;
	        }

	        earthMesh.scale.set(coordSys.radius, coordSys.radius, coordSys.radius);

	        earthMesh.setTextureImage('diffuseMap', globeModel.get('baseTexture'), api, {
	            flipY: false,
	            anisotropic: 8
	        });

	        // Update bump map
	        earthMesh.setTextureImage('bumpMap', globeModel.get('heightTexture'), api, {
	            flipY: false,
	            anisotropic: 8
	        });

	        this._updateLight(globeModel, api);

	        this._displaceVertices(globeModel, api);

	        // Update camera
	        var viewControlModel = globeModel.getModel('viewControl');

	        var camera = coordSys.viewGL.camera;

	        var position = viewControlModel.get('position');
	        var quaternion = viewControlModel.get('quaternion');
	        if (position != null) {
	            camera.position.setArray(position);
	        }
	        else {
	            camera.position.z = coordSys.radius
	                + viewControlModel.get('distance');
	        }
	        if (quaternion != null) {
	            camera.lookAt(graphicGL.Vector3.ZERO);
	        }

	        function makeAction() {
	            return {
	                type: 'globeUpdateCamera',
	                position: camera.position.toArray(),
	                quaternion: camera.rotation.toArray(),
	                from: this.uid,
	                globeId: globeModel.id
	            };
	        }
	        api.dispatchAction(makeAction());

	        // Update control
	        var control = this._control;
	        control.setCamera(camera);

	        control.autoRotate = viewControlModel.get('autoRotate');
	        control.autoRotateAfterStill = viewControlModel.get('autoRotateAfterStill');

	        control.minDistance = viewControlModel.get('minDistance') + coordSys.radius;
	        control.maxDistance = viewControlModel.get('maxDistance') + coordSys.radius;

	        control.setDistance(viewControlModel.get('distance') + coordSys.radius);

	        control.off('update');
	        control.on('update', function () {
	            api.dispatchAction(makeAction());
	        });
	    },

	    _displaceVertices: function (globeModel, api) {
	        var displacementTextureValue = globeModel.get('displacementTexture') || globeModel.get('heightTexture');
	        var displacementScale = globeModel.get('displacementScale');

	        if (!displacementTextureValue || displacementTextureValue === 'none') {
	            displacementScale = 0;
	        }
	        if (displacementScale === this._displacementScale) {
	            return;
	        }
	        this._displacementScale = displacementScale;

	        var geometry = this._sphereGeometry;

	        var img;
	        if (graphicGL.isImage(displacementTextureValue)) {
	            img = displacementTextureValue;
	            this._doDisplaceVertices(geometry, img, displacementScale);
	        }
	        else {
	            img = new Image();
	            var self = this;
	            img.onload = function () {
	                self._doDisplaceVertices(geometry, img, displacementScale);
	            };
	            img.src = displacementTextureValue;
	        }
	    },

	    _doDisplaceVertices: function (geometry, img, displacementScale) {
	        var positionArr = geometry.attributes.position.value;
	        var uvArr = geometry.attributes.texcoord0.value;

	        var originalPositionArr = geometry.__originalPosition;
	        if (!originalPositionArr || originalPositionArr.length !== positionArr.length) {
	            originalPositionArr = new Float32Array(positionArr.length);
	            originalPositionArr.set(positionArr);
	            geometry.__originalPosition = originalPositionArr;
	        }

	        var canvas = document.createElement('canvas');
	        var ctx = canvas.getContext('2d');
	        var width = img.width;
	        var height = img.height;
	        canvas.width = width;
	        canvas.height = height;
	        ctx.drawImage(img, 0, 0, width, height);
	        var rgbaArr = ctx.getImageData(0, 0, width, height).data;

	        for (var i = 0; i < geometry.vertexCount; i++) {
	            var i3 = i * 3;
	            var i2 = i * 2;
	            var x = originalPositionArr[i3 + 1];
	            var y = originalPositionArr[i3 + 2];
	            var z = originalPositionArr[i3 + 3];

	            var u = uvArr[i2++];
	            var v = uvArr[i2++];

	            var j = Math.round(u * (width - 1));
	            var k = Math.round(v * (height - 1));
	            var idx = k * width + j;
	            var scale = rgbaArr[idx * 4] / 255 * displacementScale;

	            positionArr[i3 + 1] = x + x * scale;
	            positionArr[i3 + 2] = y + y * scale;
	            positionArr[i3 + 3] = z + z * scale;
	        }

	        geometry.generateVertexNormals();
	        geometry.dirty();
	    },

	    _updateLight: function (globeModel, api) {
	        var earthMesh = this._earthMesh;

	        var sunLight = this._sunLight;
	        var ambientLight = this._ambientLight;

	        var lightModel = globeModel.getModel('light');
	        sunLight.intensity = lightModel.get('sunIntensity');
	        ambientLight.intensity = lightModel.get('ambientIntensity');

	        // Put sun in the right position
	        var time = lightModel.get('time') || new Date();

	        // http://en.wikipedia.org/wiki/Azimuth
	        var pos = sunCalc.getPosition(Date.parse(time), 0, 0);
	        var r0 = Math.cos(pos.altitude);
	        // FIXME How to calculate the y ?
	        sunLight.position.y = -r0 * Math.cos(pos.azimuth);
	        sunLight.position.x = Math.sin(pos.altitude);
	        sunLight.position.z = r0 * Math.sin(pos.azimuth);
	        sunLight.lookAt(earthMesh.getWorldPosition());

	    },

	    dispose: function () {
	        this.groupGL.removeAll();
	    }
	});

/***/ },
/* 39 */
/***/ function(module, exports, __webpack_require__) {

	var Mesh = __webpack_require__(40);
	var Texture2D = __webpack_require__(41);
	var Shader = __webpack_require__(18);
	var Material = __webpack_require__(20);
	var Node3D = __webpack_require__(28);
	var StaticGeometry = __webpack_require__(32);
	var echarts = __webpack_require__(2);
	var Scene = __webpack_require__(43);
	var LRUCache = __webpack_require__(45);

	var animatableMixin = __webpack_require__(46);
	echarts.util.extend(Node3D.prototype, animatableMixin);

	function isValueNone(value) {
	    return !value || value === 'none';
	}

	function isValueImage(value) {
	    return value instanceof HTMLCanvasElement
	        || value instanceof HTMLImageElement
	        || value instanceof Image;
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

	    if (!isValueNone(imgValue)) {
	        graphicGL.loadTexture(imgValue, api, textureOpts, function (texture) {
	            material.shader.enableTexture(textureName);
	            material.set(textureName, texture);
	            zr && zr.refresh();
	        });
	    }
	    else {
	        material.shader.disableTexture(textureName);
	    }

	    return material.get(textureName);
	};

	var graphicGL = {};

	graphicGL.Node = Node3D;

	graphicGL.Mesh = Mesh;

	graphicGL.Shader = Shader;

	graphicGL.Material = Material;

	graphicGL.Texture2D = Texture2D;

	// Geometries
	graphicGL.Geometry = StaticGeometry;

	graphicGL.SphereGeometry = __webpack_require__(51);

	graphicGL.PlaneGeometry = __webpack_require__(52);

	graphicGL.CubeGeometry = __webpack_require__(53);

	// Lights
	graphicGL.AmbientLight = __webpack_require__(54);
	graphicGL.DirectionalLight = __webpack_require__(55);
	graphicGL.PointLight = __webpack_require__(56);
	graphicGL.SpotLight = __webpack_require__(57);

	// Math
	graphicGL.Vector2 = __webpack_require__(22);
	graphicGL.Vector3 = __webpack_require__(14);
	graphicGL.Vector4 = __webpack_require__(58);

	graphicGL.Quaternion = __webpack_require__(29);

	graphicGL.Matrix2 = __webpack_require__(59);
	graphicGL.Matrix2d = __webpack_require__(60);
	graphicGL.Matrix3 = __webpack_require__(61);
	graphicGL.Matrix4 = __webpack_require__(16);

	graphicGL.Plane = __webpack_require__(62);
	graphicGL.Ray = __webpack_require__(26);
	graphicGL.BoundingBox = __webpack_require__(13);
	graphicGL.Frustum = __webpack_require__(63);

	// Texture utilities

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

	    if (isValueImage(imgValue)) {
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
	            textureObj.put(prefix + id, textureObj);
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

/***/ },
/* 40 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';


	    var Renderable = __webpack_require__(27);
	    var glenum = __webpack_require__(11);

	    /**
	     * @constructor qtek.Mesh
	     * @extends qtek.Renderable
	     */
	    var Mesh = Renderable.extend(
	    /** @lends qtek.Mesh# */
	    {
	        /**
	         * Used when it is a skinned mesh
	         * @type {qtek.Skeleton}
	         */
	        skeleton: null,
	        /**
	         * Joints indices Meshes can share the one skeleton instance and each mesh can use one part of joints. Joints indices indicate the index of joint in the skeleton instance
	         * @type {number[]}
	         */
	        joints: null

	    }, function () {
	        if (!this.joints) {
	            this.joints = [];
	        }
	    }, {
	        render: function(_gl, globalMaterial) {
	            var material = globalMaterial || this.material;
	            // Set pose matrices of skinned mesh
	            if (this.skeleton) {
	                var skinMatricesArray = this.skeleton.getSubSkinMatrices(this.__GUID__, this.joints);
	                material.shader.setUniformOfSemantic(_gl, 'SKIN_MATRIX', skinMatricesArray);
	            }

	            return Renderable.prototype.render.call(this, _gl, globalMaterial);
	        }
	    });

	    // Enums
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

	    module.exports = Mesh;


/***/ },
/* 41 */
/***/ function(module, exports, __webpack_require__) {

	

	    var Texture = __webpack_require__(21);
	    var glinfo = __webpack_require__(10);
	    var glenum = __webpack_require__(11);
	    var mathUtil = __webpack_require__(42);
	    var isPowerOfTwo = mathUtil.isPowerOfTwo;

	    /**
	     * @constructor qtek.Texture2D
	     * @extends qtek.Texture
	     *
	     * @example
	     *     ...
	     *     var mat = new qtek.Material({
	     *         shader: qtek.shader.library.get('qtek.phong', 'diffuseMap')
	     *     });
	     *     var diffuseMap = new qtek.Texture2D();
	     *     diffuseMap.load('assets/textures/diffuse.jpg');
	     *     mat.set('diffuseMap', diffuseMap);
	     *     ...
	     *     diffuseMap.success(function() {
	     *         // Wait for the diffuse texture loaded
	     *         animation.on('frame', function(frameTime) {
	     *             renderer.render(scene, camera);
	     *         });
	     *     });
	     */
	    var Texture2D = Texture.extend(function() {
	        return /** @lends qtek.Texture2D# */ {
	            /**
	             * @type {HTMLImageElement|HTMLCanvasElemnet}
	             */
	            image: null,
	            /**
	             * @type {Uint8Array|Float32Array}
	             */
	            pixels: null,
	            /**
	             * @type {Array.<Object>}
	             * @example
	             *     [{
	             *         image: mipmap0,
	             *         pixels: null
	             *     }, {
	             *         image: mipmap1,
	             *         pixels: null
	             *     }, ....]
	             */
	            mipmaps: []
	        };
	    }, {
	        update: function(_gl) {

	            _gl.bindTexture(_gl.TEXTURE_2D, this._cache.get('webgl_texture'));

	            this.beforeUpdate( _gl);

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

	            // Fallback to float type if browser don't have half float extension
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
	            }
	            else {
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
	            }
	            else {
	                // Can be used as a blank texture when writing render to texture(RTT)
	                if (
	                    glFormat <= Texture.COMPRESSED_RGBA_S3TC_DXT5_EXT
	                    && glFormat >= Texture.COMPRESSED_RGB_S3TC_DXT1_EXT
	                ) {
	                    _gl.compressedTexImage2D(_gl.TEXTURE_2D, level, glFormat, width, height, 0, data.pixels);
	                }
	                else {
	                    // Is a render target if pixels is null
	                    _gl.texImage2D(_gl.TEXTURE_2D, level, glFormat, width, height, 0, glFormat, glType, data.pixels);
	                }
	            }
	        },

	        /**
	         * @param  {WebGLRenderingContext} _gl
	         * @memberOf qtek.Texture2D.prototype
	         */
	        generateMipmap: function(_gl) {
	            if (this.useMipmap && !this.NPOT) {
	                _gl.bindTexture(_gl.TEXTURE_2D, this._cache.get('webgl_texture'));
	                _gl.generateMipmap(_gl.TEXTURE_2D);
	            }
	        },

	        isPowerOfTwo: function() {
	            var width;
	            var height;
	            if (this.image) {
	                width = this.image.width;
	                height = this.image.height;
	            }
	            else {
	                width = this.width;
	                height = this.height;
	            }
	            return isPowerOfTwo(width) && isPowerOfTwo(height);
	        },

	        isRenderable: function() {
	            if (this.image) {
	                return this.image.nodeName === 'CANVAS'
	                    || this.image.nodeName === 'VIDEO'
	                    || this.image.complete;
	            }
	            else {
	                return !!(this.width && this.height);
	            }
	        },

	        bind: function(_gl) {
	            _gl.bindTexture(_gl.TEXTURE_2D, this.getWebGLTexture(_gl));
	        },

	        unbind: function(_gl) {
	            _gl.bindTexture(_gl.TEXTURE_2D, null);
	        },

	        load: function (src) {
	            var image = new Image();
	            var self = this;
	            image.onload = function() {
	                self.dirty();
	                self.trigger('success', self);
	                image.onload = null;
	            };
	            image.onerror = function() {
	                self.trigger('error', self);
	                image.onerror = null;
	            };

	            image.src = src;
	            this.image = image;

	            return this;
	        }
	    });

	    module.exports = Texture2D;


/***/ },
/* 42 */
/***/ function(module, exports) {

	

	    var mathUtil = {};

	    mathUtil.isPowerOfTwo = function (value) {
	        return (value & (value - 1)) === 0;
	    };

	    mathUtil.nextPowerOfTwo = function (value) {
	        value --;
	        value |= value >> 1;
	        value |= value >> 2;
	        value |= value >> 4;
	        value |= value >> 8;
	        value |= value >> 16;
	        value ++;

	        return value;
	    };

	    mathUtil.nearestPowerOfTwo = function (value) {
	        return Math.pow( 2, Math.round( Math.log( value ) / Math.LN2 ) );
	    };

	    module.exports = mathUtil;


/***/ },
/* 43 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';


	    var Node = __webpack_require__(28);
	    var Light = __webpack_require__(44);
	    var BoundingBox = __webpack_require__(13);

	    /**
	     * @constructor qtek.Scene
	     * @extends qtek.Node
	     */
	    var Scene = Node.extend(function () {
	        return /** @lends qtek.Scene# */ {
	            /**
	             * Global material of scene
	             * @type {Material}
	             */
	            material: null,

	            /**
	             * @type {boolean}
	             */
	            autoUpdate: true,

	            /**
	             * Opaque renderable list, it will be updated automatically
	             * @type {Renderable[]}
	             * @readonly
	             */
	            opaqueQueue: [],

	            /**
	             * Opaque renderable list, it will be updated automatically
	             * @type {Renderable[]}
	             * @readonly
	             */
	            transparentQueue: [],

	            lights: [],


	            /**
	             * Scene bounding box in view space.
	             * Used when camera needs to adujst the near and far plane automatically
	             * so that the view frustum contains the visible objects as tightly as possible.
	             * Notice:
	             *  It is updated after rendering (in the step of frustum culling passingly). So may be not so accurate, but saves a lot of calculation
	             *
	             * @type {qtek.math.BoundingBox}
	             */
	            viewBoundingBoxLastFrame: new BoundingBox(),

	            // Properties to save the light information in the scene
	            // Will be set in the render function
	            _lightUniforms: {},

	            _lightNumber: {
	                // groupId: {
	                    // POINT_LIGHT: 0,
	                    // DIRECTIONAL_LIGHT: 0,
	                    // SPOT_LIGHT: 0,
	                    // AMBIENT_LIGHT: 0,
	                    // AMBIENT_SH_LIGHT: 0
	                // }
	            },

	            _opaqueObjectCount: 0,
	            _transparentObjectCount: 0,

	            _nodeRepository: {},

	        };
	    }, function () {
	        this._scene = this;
	    },
	    /** @lends qtek.Scene.prototype. */
	    {
	        /**
	         * Add node to scene
	         * @param {Node} node
	         */
	        addToScene: function (node) {
	            if (node.name) {
	                this._nodeRepository[node.name] = node;
	            }
	        },

	        /**
	         * Remove node from scene
	         * @param {Node} node
	         */
	        removeFromScene: function (node) {
	            if (node.name) {
	                delete this._nodeRepository[node.name];
	            }
	        },

	        /**
	         * Get node by name
	         * @param  {string} name
	         * @return {Node}
	         * @DEPRECATED
	         */
	        getNode: function (name) {
	            return this._nodeRepository[name];
	        },

	        /**
	         * Clone a new scene node recursively, including material, skeleton.
	         * Shader and geometry instances will not been cloned
	         * @param  {qtek.Node} node
	         * @return {qtek.Node}
	         */
	        cloneNode: function (node) {
	            var newNode = node.clone();
	            var materialsMap = {};

	            var cloneSkeleton = function (current, currentNew) {
	                if (current.skeleton) {
	                    currentNew.skeleton = current.skeleton.clone(node, newNode);
	                    currentNew.joints = current.joints.slice();
	                }
	                if (current.material) {
	                    materialsMap[current.material.__GUID__] = {
	                        oldMat: current.material
	                    };
	                }
	                for (var i = 0; i < current._children.length; i++) {
	                    cloneSkeleton(current._children[i], currentNew._children[i]);
	                }
	            };

	            cloneSkeleton(node, newNode);

	            for (var guid in materialsMap) {
	                materialsMap[guid].newMat = materialsMap[guid].oldMat.clone();
	            }

	            // Replace material
	            newNode.traverse(function (current) {
	                if (current.material) {
	                    current.material = materialsMap[current.material.__GUID__].newMat;
	                }
	            });

	            return newNode;
	        },


	        /**
	         * Scene update
	         * @param  {boolean} force
	         * @param  {boolean} notUpdateLights
	         *         Useful in deferred pipeline
	         */
	        update: function (force, notUpdateLights) {
	            if (!(this.autoUpdate || force)) {
	                return;
	            }
	            Node.prototype.update.call(this, force);

	            var lights = this.lights;
	            var sceneMaterialTransparent = this.material && this.material.transparent;

	            this._opaqueObjectCount = 0;
	            this._transparentObjectCount = 0;

	            lights.length = 0;

	            this._updateRenderQueue(this, sceneMaterialTransparent);

	            this.opaqueQueue.length = this._opaqueObjectCount;
	            this.transparentQueue.length = this._transparentObjectCount;

	            // reset
	            if (!notUpdateLights) {
	                var lightNumber = this._lightNumber;
	                // Reset light numbers
	                for (var group in lightNumber) {
	                    for (var type in lightNumber[group]) {
	                        lightNumber[group][type] = 0;
	                    }
	                }
	                for (var i = 0; i < lights.length; i++) {
	                    var light = lights[i];
	                    var group = light.group;
	                    if (!lightNumber[group]) {
	                        lightNumber[group] = {};
	                    }
	                    // User can use any type of light
	                    lightNumber[group][light.type] = lightNumber[group][light.type] || 0;
	                    lightNumber[group][light.type]++;
	                }
	                // PENDING Remove unused group?

	                this._updateLightUniforms();
	            }
	        },

	        // Traverse the scene and add the renderable
	        // object to the render queue
	        _updateRenderQueue: function (parent, sceneMaterialTransparent) {
	            if (parent.invisible) {
	                return;
	            }

	            for (var i = 0; i < parent._children.length; i++) {
	                var child = parent._children[i];

	                if (child instanceof Light) {
	                    this.lights.push(child);
	                }
	                if (child.isRenderable()) {
	                    if (child.material.transparent || sceneMaterialTransparent) {
	                        this.transparentQueue[this._transparentObjectCount++] = child;
	                    }
	                    else {
	                        this.opaqueQueue[this._opaqueObjectCount++] = child;
	                    }
	                }
	                if (child._children.length > 0) {
	                    this._updateRenderQueue(child);
	                }
	            }
	        },

	        _updateLightUniforms: function () {
	            var lights = this.lights;
	            // Put the light cast shadow before the light not cast shadow
	            lights.sort(lightSortFunc);

	            var lightUniforms = this._lightUniforms;
	            for (var group in lightUniforms) {
	                for (var symbol in lightUniforms[group]) {
	                    lightUniforms[group][symbol].value.length = 0;
	                }
	            }
	            for (var i = 0; i < lights.length; i++) {

	                var light = lights[i];
	                var group = light.group;

	                for (var symbol in light.uniformTemplates) {

	                    var uniformTpl = light.uniformTemplates[symbol];
	                    if (!lightUniforms[group]) {
	                        lightUniforms[group] = {};
	                    }
	                    if (!lightUniforms[group][symbol]) {
	                        lightUniforms[group][symbol] = {
	                            type: '',
	                            value: []
	                        };
	                    }
	                    var value = uniformTpl.value(light);
	                    var lu = lightUniforms[group][symbol];
	                    lu.type = uniformTpl.type + 'v';
	                    switch (uniformTpl.type) {
	                        case '1i':
	                        case '1f':
	                        case 't':
	                            lu.value.push(value);
	                            break;
	                        case '2f':
	                        case '3f':
	                        case '4f':
	                            for (var j =0; j < value.length; j++) {
	                                lu.value.push(value[j]);
	                            }
	                            break;
	                        default:
	                            console.error('Unkown light uniform type ' + uniformTpl.type);
	                    }
	                }
	            }
	        },

	        isShaderLightNumberChanged: function (shader) {
	            var group = shader.lightGroup;
	            // PENDING Performance
	            for (var type in this._lightNumber[group]) {
	                if (this._lightNumber[group][type] !== shader.lightNumber[type]) {
	                    return true;
	                }
	            }
	            for (var type in shader.lightNumber) {
	                if (this._lightNumber[group][type] !== shader.lightNumber[type]) {
	                    return true;
	                }
	            }
	            return false;
	        },

	        setShaderLightNumber: function (shader) {
	            var group = shader.lightGroup;
	            for (var type in this._lightNumber[group]) {
	                shader.lightNumber[type] = this._lightNumber[group][type];
	            }
	            shader.dirty();
	        },

	        setLightUniforms: function (shader, _gl) {
	            var group = shader.lightGroup;
	            for (var symbol in this._lightUniforms[group]) {
	                var lu = this._lightUniforms[group][symbol];
	                if (lu.type === 'tv') {
	                    for (var i = 0; i < lu.value.length; i++) {
	                        var texture = lu.value[i];
	                        var slot = shader.currentTextureSlot();
	                        var result = shader.setUniform(_gl, '1i', symbol, slot);
	                        if (result) {
	                            shader.useCurrentTextureSlot(_gl, texture);
	                        }
	                    }
	                }
	                else {
	                    shader.setUniform(_gl, lu.type, symbol, lu.value);
	                }
	            }
	        },

	        /**
	         * Dispose self, clear all the scene objects
	         * But resources of gl like texuture, shader will not be disposed.
	         * Mostly you should use disposeScene method in Renderer to do dispose.
	         */
	        dispose: function () {
	            this.material = null;
	            this.opaqueQueue = [];
	            this.transparentQueue = [];

	            this.lights = [];

	            this._lightUniforms = {};

	            this._lightNumber = {};
	            this._nodeRepository = {};
	        }
	    });

	    function lightSortFunc(a, b) {
	        if (b.castShadow && !a.castShadow) {
	            return true;
	        }
	    }

	    module.exports = Scene;


/***/ },
/* 44 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';


	    var Node = __webpack_require__(28);

	    /**
	     * @constructor qtek.Light
	     * @extends qtek.Node
	     */
	    var Light = Node.extend(function(){
	        return /** @lends qtek.Light# */ {
	            /**
	             * Light RGB color
	             * @type {number[]}
	             */
	            color: [1, 1, 1],

	            /**
	             * Light intensity
	             * @type {number}
	             */
	            intensity: 1.0,

	            // Config for shadow map
	            /**
	             * If light cast shadow
	             * @type {boolean}
	             */
	            castShadow: true,

	            /**
	             * Shadow map size
	             * @type {number}
	             */
	            shadowResolution: 512,

	            /**
	             * Light group, shader with same `lightGroup` will be affected
	             *
	             * Only useful in forward rendering
	             * @type {number}
	             */
	            group: 0
	        };
	    },
	    /** @lends qtek.Light.prototype. */
	    {
	        /**
	         * Light type
	         * @type {string}
	         * @memberOf qtek.Light#
	         */
	        type: '',

	        /**
	         * @return {qtek.Light}
	         * @memberOf qtek.Light.prototype
	         */
	        clone: function() {
	            var light = Node.prototype.clone.call(this);
	            light.color = Array.prototype.slice.call(this.color);
	            light.intensity = this.intensity;
	            light.castShadow = this.castShadow;
	            light.shadowResolution = this.shadowResolution;

	            return light;
	        }
	    });

	    module.exports = Light;


/***/ },
/* 45 */
/***/ function(module, exports) {

	// Simple LRU cache use doubly linked list
	// @module zrender/core/LRU


	    /**
	     * Simple double linked list. Compared with array, it has O(1) remove operation.
	     * @constructor
	     */
	    var LinkedList = function () {

	        /**
	         * @type {module:zrender/core/LRU~Entry}
	         */
	        this.head = null;

	        /**
	         * @type {module:zrender/core/LRU~Entry}
	         */
	        this.tail = null;

	        this._len = 0;
	    };

	    var linkedListProto = LinkedList.prototype;
	    /**
	     * Insert a new value at the tail
	     * @param  {} val
	     * @return {module:zrender/core/LRU~Entry}
	     */
	    linkedListProto.insert = function (val) {
	        var entry = new Entry(val);
	        this.insertEntry(entry);
	        return entry;
	    };

	    /**
	     * Insert an entry at the tail
	     * @param  {module:zrender/core/LRU~Entry} entry
	     */
	    linkedListProto.insertEntry = function (entry) {
	        if (!this.head) {
	            this.head = this.tail = entry;
	        }
	        else {
	            this.tail.next = entry;
	            entry.prev = this.tail;
	            entry.next = null;
	            this.tail = entry;
	        }
	        this._len++;
	    };

	    /**
	     * Remove entry.
	     * @param  {module:zrender/core/LRU~Entry} entry
	     */
	    linkedListProto.remove = function (entry) {
	        var prev = entry.prev;
	        var next = entry.next;
	        if (prev) {
	            prev.next = next;
	        }
	        else {
	            // Is head
	            this.head = next;
	        }
	        if (next) {
	            next.prev = prev;
	        }
	        else {
	            // Is tail
	            this.tail = prev;
	        }
	        entry.next = entry.prev = null;
	        this._len--;
	    };

	    /**
	     * @return {number}
	     */
	    linkedListProto.len = function () {
	        return this._len;
	    };

	    /**
	     * @constructor
	     * @param {} val
	     */
	    var Entry = function (val) {
	        /**
	         * @type {}
	         */
	        this.value = val;

	        /**
	         * @type {module:zrender/core/LRU~Entry}
	         */
	        this.next;

	        /**
	         * @type {module:zrender/core/LRU~Entry}
	         */
	        this.prev;
	    };

	    /**
	     * LRU Cache
	     * @constructor
	     * @alias module:zrender/core/LRU
	     */
	    var LRU = function (maxSize) {

	        this._list = new LinkedList();

	        this._map = {};

	        this._maxSize = maxSize || 10;

	        this._lastRemovedEntry = null;
	    };

	    var LRUProto = LRU.prototype;

	    /**
	     * @param  {string} key
	     * @param  {} value
	     * @return {} Removed value
	     */
	    LRUProto.put = function (key, value) {
	        var list = this._list;
	        var map = this._map;
	        var removed = null;
	        if (map[key] == null) {
	            var len = list.len();
	            // Reuse last removed entry
	            var entry = this._lastRemovedEntry;

	            if (len >= this._maxSize && len > 0) {
	                // Remove the least recently used
	                var leastUsedEntry = list.head;
	                list.remove(leastUsedEntry);
	                delete map[leastUsedEntry.key];

	                removed = leastUsedEntry.value;
	                this._lastRemovedEntry = leastUsedEntry;
	            }

	            if (entry) {
	                entry.value = value;
	            }
	            else {
	                entry = new Entry(value);
	            }
	            entry.key = key;
	            list.insertEntry(entry);
	            map[key] = entry;
	        }

	        return removed;
	    };

	    /**
	     * @param  {string} key
	     * @return {}
	     */
	    LRUProto.get = function (key) {
	        var entry = this._map[key];
	        var list = this._list;
	        if (entry != null) {
	            // Put the latest used entry in the tail
	            if (entry !== list.tail) {
	                list.remove(entry);
	                list.insertEntry(entry);
	            }

	            return entry.value;
	        }
	    };

	    /**
	     * Clear the cache
	     */
	    LRUProto.clear = function () {
	        this._list.clear();
	        this._map = {};
	    };

	    module.exports = LRU;


/***/ },
/* 46 */
/***/ function(module, exports, __webpack_require__) {

	var Animator = __webpack_require__(47);

	var animatableMixin = {

	    _animators: null,

	    getAnimators: function () {
	        this._animators = this._animators || [];

	        return this._animators;
	    },

	    animate: function (path, opts) {
	        this._animators = this._animators || [];

	        var el = this;

	        var target;

	        if (path) {
	            var pathSplitted = path.split('.');
	            var prop = el;
	            for (var i = 0, l = pathSplitted.length; i < l; i++) {
	                if (!prop) {
	                    continue;
	                }
	                prop = prop[pathSplitted[i]];
	            }
	            if (prop) {
	                target = prop;
	            }
	        }
	        else {
	            target = el;
	        }

	        var animators = this._animators;

	        var animator = new Animator(target, opts);
	        var self = this;
	        animator.during(function () {
	            if (self.__zr) {
	                self.__zr.refresh();
	            }
	        }).done(function () {
	            var idx = animators.indexOf(animator);
	            if (idx >= 0) {
	                animators.splice(idx, 1);
	            }
	        });
	        animators.push(animator);

	        if (this.__zr) {
	            this.__zr.animation.addAnimator(animator);
	        }
	    },

	    stopAnimation: function (forwardToLast) {
	        this._animators = this._animators || [];

	        var animators = this._animators;
	        var len = animators.length;
	        for (var i = 0; i < len; i++) {
	            animators[i].stop(forwardToLast);
	        }
	        animators.length = 0;

	        return this;
	    },

	    addAnimatorsToZr: function (zr) {
	        if (this._animators) {
	            for (var i = 0; i < this._animators.length; i++) {
	                zr.animation.addAnimator(this._animators[i]);
	            }
	        }
	    },

	    removeAnimatorsFromZr: function (zr) {
	        if (this._animators) {
	            for (var i = 0; i < this._animators.length; i++) {
	                zr.animation.removeAnimator(this._animators[i]);
	            }
	        }
	    }
	}

	module.exports = animatableMixin;

/***/ },
/* 47 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * @module echarts/animation/Animator
	 */


	    var Clip = __webpack_require__(48);
	    var color = __webpack_require__(50);
	    var util = __webpack_require__(34);
	    var isArrayLike = util.isArrayLike;

	    var arraySlice = Array.prototype.slice;

	    function defaultGetter(target, key) {
	        return target[key];
	    }

	    function defaultSetter(target, key, value) {
	        target[key] = value;
	    }

	    /**
	     * @param  {number} p0
	     * @param  {number} p1
	     * @param  {number} percent
	     * @return {number}
	     */
	    function interpolateNumber(p0, p1, percent) {
	        return (p1 - p0) * percent + p0;
	    }

	    /**
	     * @param  {string} p0
	     * @param  {string} p1
	     * @param  {number} percent
	     * @return {string}
	     */
	    function interpolateString(p0, p1, percent) {
	        return percent > 0.5 ? p1 : p0;
	    }

	    /**
	     * @param  {Array} p0
	     * @param  {Array} p1
	     * @param  {number} percent
	     * @param  {Array} out
	     * @param  {number} arrDim
	     */
	    function interpolateArray(p0, p1, percent, out, arrDim) {
	        var len = p0.length;
	        if (arrDim == 1) {
	            for (var i = 0; i < len; i++) {
	                out[i] = interpolateNumber(p0[i], p1[i], percent);
	            }
	        }
	        else {
	            var len2 = p0[0].length;
	            for (var i = 0; i < len; i++) {
	                for (var j = 0; j < len2; j++) {
	                    out[i][j] = interpolateNumber(
	                        p0[i][j], p1[i][j], percent
	                    );
	                }
	            }
	        }
	    }

	    // arr0 is source array, arr1 is target array.
	    // Do some preprocess to avoid error happened when interpolating from arr0 to arr1
	    function fillArr(arr0, arr1, arrDim) {
	        var arr0Len = arr0.length;
	        var arr1Len = arr1.length;
	        if (arr0Len !== arr1Len) {
	            // FIXME Not work for TypedArray
	            var isPreviousLarger = arr0Len > arr1Len;
	            if (isPreviousLarger) {
	                // Cut the previous
	                arr0.length = arr1Len;
	            }
	            else {
	                // Fill the previous
	                for (var i = arr0Len; i < arr1Len; i++) {
	                    arr0.push(
	                        arrDim === 1 ? arr1[i] : arraySlice.call(arr1[i])
	                    );
	                }
	            }
	        }
	        // Handling NaN value
	        var len2 = arr0[0] && arr0[0].length;
	        for (var i = 0; i < arr0.length; i++) {
	            if (arrDim === 1) {
	                if (isNaN(arr0[i])) {
	                    arr0[i] = arr1[i];
	                }
	            }
	            else {
	                for (var j = 0; j < len2; j++) {
	                    if (isNaN(arr0[i][j])) {
	                        arr0[i][j] = arr1[i][j];
	                    }
	                }
	            }
	        }
	    }

	    /**
	     * @param  {Array} arr0
	     * @param  {Array} arr1
	     * @param  {number} arrDim
	     * @return {boolean}
	     */
	    function isArraySame(arr0, arr1, arrDim) {
	        if (arr0 === arr1) {
	            return true;
	        }
	        var len = arr0.length;
	        if (len !== arr1.length) {
	            return false;
	        }
	        if (arrDim === 1) {
	            for (var i = 0; i < len; i++) {
	                if (arr0[i] !== arr1[i]) {
	                    return false;
	                }
	            }
	        }
	        else {
	            var len2 = arr0[0].length;
	            for (var i = 0; i < len; i++) {
	                for (var j = 0; j < len2; j++) {
	                    if (arr0[i][j] !== arr1[i][j]) {
	                        return false;
	                    }
	                }
	            }
	        }
	        return true;
	    }

	    /**
	     * Catmull Rom interpolate array
	     * @param  {Array} p0
	     * @param  {Array} p1
	     * @param  {Array} p2
	     * @param  {Array} p3
	     * @param  {number} t
	     * @param  {number} t2
	     * @param  {number} t3
	     * @param  {Array} out
	     * @param  {number} arrDim
	     */
	    function catmullRomInterpolateArray(
	        p0, p1, p2, p3, t, t2, t3, out, arrDim
	    ) {
	        var len = p0.length;
	        if (arrDim == 1) {
	            for (var i = 0; i < len; i++) {
	                out[i] = catmullRomInterpolate(
	                    p0[i], p1[i], p2[i], p3[i], t, t2, t3
	                );
	            }
	        }
	        else {
	            var len2 = p0[0].length;
	            for (var i = 0; i < len; i++) {
	                for (var j = 0; j < len2; j++) {
	                    out[i][j] = catmullRomInterpolate(
	                        p0[i][j], p1[i][j], p2[i][j], p3[i][j],
	                        t, t2, t3
	                    );
	                }
	            }
	        }
	    }

	    /**
	     * Catmull Rom interpolate number
	     * @param  {number} p0
	     * @param  {number} p1
	     * @param  {number} p2
	     * @param  {number} p3
	     * @param  {number} t
	     * @param  {number} t2
	     * @param  {number} t3
	     * @return {number}
	     */
	    function catmullRomInterpolate(p0, p1, p2, p3, t, t2, t3) {
	        var v0 = (p2 - p0) * 0.5;
	        var v1 = (p3 - p1) * 0.5;
	        return (2 * (p1 - p2) + v0 + v1) * t3
	                + (-3 * (p1 - p2) - 2 * v0 - v1) * t2
	                + v0 * t + p1;
	    }

	    function cloneValue(value) {
	        if (isArrayLike(value)) {
	            var len = value.length;
	            if (isArrayLike(value[0])) {
	                var ret = [];
	                for (var i = 0; i < len; i++) {
	                    ret.push(arraySlice.call(value[i]));
	                }
	                return ret;
	            }

	            return arraySlice.call(value);
	        }

	        return value;
	    }

	    function rgba2String(rgba) {
	        rgba[0] = Math.floor(rgba[0]);
	        rgba[1] = Math.floor(rgba[1]);
	        rgba[2] = Math.floor(rgba[2]);

	        return 'rgba(' + rgba.join(',') + ')';
	    }

	    function createTrackClip (animator, easing, oneTrackDone, keyframes, propName) {
	        var getter = animator._getter;
	        var setter = animator._setter;
	        var useSpline = easing === 'spline';

	        var trackLen = keyframes.length;
	        if (!trackLen) {
	            return;
	        }
	        // Guess data type
	        var firstVal = keyframes[0].value;
	        var isValueArray = isArrayLike(firstVal);
	        var isValueColor = false;
	        var isValueString = false;

	        // For vertices morphing
	        var arrDim = (
	                isValueArray
	                && isArrayLike(firstVal[0])
	            )
	            ? 2 : 1;
	        var trackMaxTime;
	        // Sort keyframe as ascending
	        keyframes.sort(function(a, b) {
	            return a.time - b.time;
	        });

	        trackMaxTime = keyframes[trackLen - 1].time;
	        // Percents of each keyframe
	        var kfPercents = [];
	        // Value of each keyframe
	        var kfValues = [];
	        var prevValue = keyframes[0].value;
	        var isAllValueEqual = true;
	        for (var i = 0; i < trackLen; i++) {
	            kfPercents.push(keyframes[i].time / trackMaxTime);
	            // Assume value is a color when it is a string
	            var value = keyframes[i].value;

	            // Check if value is equal, deep check if value is array
	            if (!((isValueArray && isArraySame(value, prevValue, arrDim))
	                || (!isValueArray && value === prevValue))) {
	                isAllValueEqual = false;
	            }
	            prevValue = value;

	            // Try converting a string to a color array
	            if (typeof value == 'string') {
	                var colorArray = color.parse(value);
	                if (colorArray) {
	                    value = colorArray;
	                    isValueColor = true;
	                }
	                else {
	                    isValueString = true;
	                }
	            }
	            kfValues.push(value);
	        }
	        if (isAllValueEqual) {
	            return;
	        }

	        var lastValue = kfValues[trackLen - 1];
	        // Polyfill array and NaN value
	        for (var i = 0; i < trackLen - 1; i++) {
	            if (isValueArray) {
	                fillArr(kfValues[i], lastValue, arrDim);
	            }
	            else {
	                if (isNaN(kfValues[i]) && !isNaN(lastValue) && !isValueString && !isValueColor) {
	                    kfValues[i] = lastValue;
	                }
	            }
	        }
	        isValueArray && fillArr(getter(animator._target, propName), lastValue, arrDim);

	        // Cache the key of last frame to speed up when
	        // animation playback is sequency
	        var lastFrame = 0;
	        var lastFramePercent = 0;
	        var start;
	        var w;
	        var p0;
	        var p1;
	        var p2;
	        var p3;

	        if (isValueColor) {
	            var rgba = [0, 0, 0, 0];
	        }

	        var onframe = function (target, percent) {
	            // Find the range keyframes
	            // kf1-----kf2---------current--------kf3
	            // find kf2 and kf3 and do interpolation
	            var frame;
	            // In the easing function like elasticOut, percent may less than 0
	            if (percent < 0) {
	                frame = 0;
	            }
	            else if (percent < lastFramePercent) {
	                // Start from next key
	                // PENDING start from lastFrame ?
	                start = Math.min(lastFrame + 1, trackLen - 1);
	                for (frame = start; frame >= 0; frame--) {
	                    if (kfPercents[frame] <= percent) {
	                        break;
	                    }
	                }
	                // PENDING really need to do this ?
	                frame = Math.min(frame, trackLen - 2);
	            }
	            else {
	                for (frame = lastFrame; frame < trackLen; frame++) {
	                    if (kfPercents[frame] > percent) {
	                        break;
	                    }
	                }
	                frame = Math.min(frame - 1, trackLen - 2);
	            }
	            lastFrame = frame;
	            lastFramePercent = percent;

	            var range = (kfPercents[frame + 1] - kfPercents[frame]);
	            if (range === 0) {
	                return;
	            }
	            else {
	                w = (percent - kfPercents[frame]) / range;
	            }
	            if (useSpline) {
	                p1 = kfValues[frame];
	                p0 = kfValues[frame === 0 ? frame : frame - 1];
	                p2 = kfValues[frame > trackLen - 2 ? trackLen - 1 : frame + 1];
	                p3 = kfValues[frame > trackLen - 3 ? trackLen - 1 : frame + 2];
	                if (isValueArray) {
	                    catmullRomInterpolateArray(
	                        p0, p1, p2, p3, w, w * w, w * w * w,
	                        getter(target, propName),
	                        arrDim
	                    );
	                }
	                else {
	                    var value;
	                    if (isValueColor) {
	                        value = catmullRomInterpolateArray(
	                            p0, p1, p2, p3, w, w * w, w * w * w,
	                            rgba, 1
	                        );
	                        value = rgba2String(rgba);
	                    }
	                    else if (isValueString) {
	                        // String is step(0.5)
	                        return interpolateString(p1, p2, w);
	                    }
	                    else {
	                        value = catmullRomInterpolate(
	                            p0, p1, p2, p3, w, w * w, w * w * w
	                        );
	                    }
	                    setter(
	                        target,
	                        propName,
	                        value
	                    );
	                }
	            }
	            else {
	                if (isValueArray) {
	                    interpolateArray(
	                        kfValues[frame], kfValues[frame + 1], w,
	                        getter(target, propName),
	                        arrDim
	                    );
	                }
	                else {
	                    var value;
	                    if (isValueColor) {
	                        interpolateArray(
	                            kfValues[frame], kfValues[frame + 1], w,
	                            rgba, 1
	                        );
	                        value = rgba2String(rgba);
	                    }
	                    else if (isValueString) {
	                        // String is step(0.5)
	                        return interpolateString(kfValues[frame], kfValues[frame + 1], w);
	                    }
	                    else {
	                        value = interpolateNumber(kfValues[frame], kfValues[frame + 1], w);
	                    }
	                    setter(
	                        target,
	                        propName,
	                        value
	                    );
	                }
	            }
	        };

	        var clip = new Clip({
	            target: animator._target,
	            life: trackMaxTime,
	            loop: animator._loop,
	            delay: animator._delay,
	            onframe: onframe,
	            ondestroy: oneTrackDone
	        });

	        if (easing && easing !== 'spline') {
	            clip.easing = easing;
	        }

	        return clip;
	    }

	    /**
	     * @alias module:zrender/animation/Animator
	     * @constructor
	     * @param {Object} target
	     * @param {boolean} loop
	     * @param {Function} getter
	     * @param {Function} setter
	     */
	    var Animator = function(target, loop, getter, setter) {
	        this._tracks = {};
	        this._target = target;

	        this._loop = loop || false;

	        this._getter = getter || defaultGetter;
	        this._setter = setter || defaultSetter;

	        this._clipCount = 0;

	        this._delay = 0;

	        this._doneList = [];

	        this._onframeList = [];

	        this._clipList = [];
	    };

	    Animator.prototype = {
	        /**
	         * 设置动画关键帧
	         * @param  {number} time 关键帧时间，单位是ms
	         * @param  {Object} props 关键帧的属性值，key-value表示
	         * @return {module:zrender/animation/Animator}
	         */
	        when: function(time /* ms */, props) {
	            var tracks = this._tracks;
	            for (var propName in props) {
	                if (!props.hasOwnProperty(propName)) {
	                    continue;
	                }

	                if (!tracks[propName]) {
	                    tracks[propName] = [];
	                    // Invalid value
	                    var value = this._getter(this._target, propName);
	                    if (value == null) {
	                        // zrLog('Invalid property ' + propName);
	                        continue;
	                    }
	                    // If time is 0
	                    //  Then props is given initialize value
	                    // Else
	                    //  Initialize value from current prop value
	                    if (time !== 0) {
	                        tracks[propName].push({
	                            time: 0,
	                            value: cloneValue(value)
	                        });
	                    }
	                }
	                tracks[propName].push({
	                    time: time,
	                    value: props[propName]
	                });
	            }
	            return this;
	        },
	        /**
	         * 添加动画每一帧的回调函数
	         * @param  {Function} callback
	         * @return {module:zrender/animation/Animator}
	         */
	        during: function (callback) {
	            this._onframeList.push(callback);
	            return this;
	        },

	        _doneCallback: function () {
	            // Clear all tracks
	            this._tracks = {};
	            // Clear all clips
	            this._clipList.length = 0;

	            var doneList = this._doneList;
	            var len = doneList.length;
	            for (var i = 0; i < len; i++) {
	                doneList[i].call(this);
	            }
	        },
	        /**
	         * 开始执行动画
	         * @param  {string|Function} easing
	         *         动画缓动函数，详见{@link module:zrender/animation/easing}
	         * @return {module:zrender/animation/Animator}
	         */
	        start: function (easing) {

	            var self = this;
	            var clipCount = 0;

	            var oneTrackDone = function() {
	                clipCount--;
	                if (!clipCount) {
	                    self._doneCallback();
	                }
	            };

	            var lastClip;
	            for (var propName in this._tracks) {
	                if (!this._tracks.hasOwnProperty(propName)) {
	                    continue;
	                }
	                var clip = createTrackClip(
	                    this, easing, oneTrackDone,
	                    this._tracks[propName], propName
	                );
	                if (clip) {
	                    this._clipList.push(clip);
	                    clipCount++;

	                    // If start after added to animation
	                    if (this.animation) {
	                        this.animation.addClip(clip);
	                    }

	                    lastClip = clip;
	                }
	            }

	            // Add during callback on the last clip
	            if (lastClip) {
	                var oldOnFrame = lastClip.onframe;
	                lastClip.onframe = function (target, percent) {
	                    oldOnFrame(target, percent);

	                    for (var i = 0; i < self._onframeList.length; i++) {
	                        self._onframeList[i](target, percent);
	                    }
	                };
	            }

	            if (!clipCount) {
	                this._doneCallback();
	            }
	            return this;
	        },
	        /**
	         * 停止动画
	         * @param {boolean} forwardToLast If move to last frame before stop
	         */
	        stop: function (forwardToLast) {
	            var clipList = this._clipList;
	            var animation = this.animation;
	            for (var i = 0; i < clipList.length; i++) {
	                var clip = clipList[i];
	                if (forwardToLast) {
	                    // Move to last frame before stop
	                    clip.onframe(this._target, 1);
	                }
	                animation && animation.removeClip(clip);
	            }
	            clipList.length = 0;
	        },
	        /**
	         * 设置动画延迟开始的时间
	         * @param  {number} time 单位ms
	         * @return {module:zrender/animation/Animator}
	         */
	        delay: function (time) {
	            this._delay = time;
	            return this;
	        },
	        /**
	         * 添加动画结束的回调
	         * @param  {Function} cb
	         * @return {module:zrender/animation/Animator}
	         */
	        done: function(cb) {
	            if (cb) {
	                this._doneList.push(cb);
	            }
	            return this;
	        },

	        /**
	         * @return {Array.<module:zrender/animation/Clip>}
	         */
	        getClips: function () {
	            return this._clipList;
	        }
	    };

	    module.exports = Animator;


/***/ },
/* 48 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * 动画主控制器
	 * @config target 动画对象，可以是数组，如果是数组的话会批量分发onframe等事件
	 * @config life(1000) 动画时长
	 * @config delay(0) 动画延迟时间
	 * @config loop(true)
	 * @config gap(0) 循环的间隔时间
	 * @config onframe
	 * @config easing(optional)
	 * @config ondestroy(optional)
	 * @config onrestart(optional)
	 *
	 * TODO pause
	 */


	    var easingFuncs = __webpack_require__(49);

	    function Clip(options) {

	        this._target = options.target;

	        // 生命周期
	        this._life = options.life || 1000;
	        // 延时
	        this._delay = options.delay || 0;
	        // 开始时间
	        // this._startTime = new Date().getTime() + this._delay;// 单位毫秒
	        this._initialized = false;

	        // 是否循环
	        this.loop = options.loop == null ? false : options.loop;

	        this.gap = options.gap || 0;

	        this.easing = options.easing || 'Linear';

	        this.onframe = options.onframe;
	        this.ondestroy = options.ondestroy;
	        this.onrestart = options.onrestart;
	    }

	    Clip.prototype = {

	        constructor: Clip,

	        step: function (globalTime) {
	            // Set startTime on first step, or _startTime may has milleseconds different between clips
	            // PENDING
	            if (!this._initialized) {
	                this._startTime = globalTime + this._delay;
	                this._initialized = true;
	            }

	            var percent = (globalTime - this._startTime) / this._life;

	            // 还没开始
	            if (percent < 0) {
	                return;
	            }

	            percent = Math.min(percent, 1);

	            var easing = this.easing;
	            var easingFunc = typeof easing == 'string' ? easingFuncs[easing] : easing;
	            var schedule = typeof easingFunc === 'function'
	                ? easingFunc(percent)
	                : percent;

	            this.fire('frame', schedule);

	            // 结束
	            if (percent == 1) {
	                if (this.loop) {
	                    this.restart (globalTime);
	                    // 重新开始周期
	                    // 抛出而不是直接调用事件直到 stage.update 后再统一调用这些事件
	                    return 'restart';
	                }

	                // 动画完成将这个控制器标识为待删除
	                // 在Animation.update中进行批量删除
	                this._needsRemove = true;
	                return 'destroy';
	            }

	            return null;
	        },

	        restart: function (globalTime) {
	            var remainder = (globalTime - this._startTime) % this._life;
	            this._startTime = globalTime - remainder + this.gap;

	            this._needsRemove = false;
	        },

	        fire: function(eventType, arg) {
	            eventType = 'on' + eventType;
	            if (this[eventType]) {
	                this[eventType](this._target, arg);
	            }
	        }
	    };

	    module.exports = Clip;



/***/ },
/* 49 */
/***/ function(module, exports) {

	/**
	 * 缓动代码来自 https://github.com/sole/tween.js/blob/master/src/Tween.js
	 * @see http://sole.github.io/tween.js/examples/03_graphs.html
	 * @exports zrender/animation/easing
	 */

	    var easing = {
	        /**
	        * @param {number} k
	        * @return {number}
	        */
	        linear: function (k) {
	            return k;
	        },

	        /**
	        * @param {number} k
	        * @return {number}
	        */
	        quadraticIn: function (k) {
	            return k * k;
	        },
	        /**
	        * @param {number} k
	        * @return {number}
	        */
	        quadraticOut: function (k) {
	            return k * (2 - k);
	        },
	        /**
	        * @param {number} k
	        * @return {number}
	        */
	        quadraticInOut: function (k) {
	            if ((k *= 2) < 1) {
	                return 0.5 * k * k;
	            }
	            return -0.5 * (--k * (k - 2) - 1);
	        },

	        // 三次方的缓动（t^3）
	        /**
	        * @param {number} k
	        * @return {number}
	        */
	        cubicIn: function (k) {
	            return k * k * k;
	        },
	        /**
	        * @param {number} k
	        * @return {number}
	        */
	        cubicOut: function (k) {
	            return --k * k * k + 1;
	        },
	        /**
	        * @param {number} k
	        * @return {number}
	        */
	        cubicInOut: function (k) {
	            if ((k *= 2) < 1) {
	                return 0.5 * k * k * k;
	            }
	            return 0.5 * ((k -= 2) * k * k + 2);
	        },

	        // 四次方的缓动（t^4）
	        /**
	        * @param {number} k
	        * @return {number}
	        */
	        quarticIn: function (k) {
	            return k * k * k * k;
	        },
	        /**
	        * @param {number} k
	        * @return {number}
	        */
	        quarticOut: function (k) {
	            return 1 - (--k * k * k * k);
	        },
	        /**
	        * @param {number} k
	        * @return {number}
	        */
	        quarticInOut: function (k) {
	            if ((k *= 2) < 1) {
	                return 0.5 * k * k * k * k;
	            }
	            return -0.5 * ((k -= 2) * k * k * k - 2);
	        },

	        // 五次方的缓动（t^5）
	        /**
	        * @param {number} k
	        * @return {number}
	        */
	        quinticIn: function (k) {
	            return k * k * k * k * k;
	        },
	        /**
	        * @param {number} k
	        * @return {number}
	        */
	        quinticOut: function (k) {
	            return --k * k * k * k * k + 1;
	        },
	        /**
	        * @param {number} k
	        * @return {number}
	        */
	        quinticInOut: function (k) {
	            if ((k *= 2) < 1) {
	                return 0.5 * k * k * k * k * k;
	            }
	            return 0.5 * ((k -= 2) * k * k * k * k + 2);
	        },

	        // 正弦曲线的缓动（sin(t)）
	        /**
	        * @param {number} k
	        * @return {number}
	        */
	        sinusoidalIn: function (k) {
	            return 1 - Math.cos(k * Math.PI / 2);
	        },
	        /**
	        * @param {number} k
	        * @return {number}
	        */
	        sinusoidalOut: function (k) {
	            return Math.sin(k * Math.PI / 2);
	        },
	        /**
	        * @param {number} k
	        * @return {number}
	        */
	        sinusoidalInOut: function (k) {
	            return 0.5 * (1 - Math.cos(Math.PI * k));
	        },

	        // 指数曲线的缓动（2^t）
	        /**
	        * @param {number} k
	        * @return {number}
	        */
	        exponentialIn: function (k) {
	            return k === 0 ? 0 : Math.pow(1024, k - 1);
	        },
	        /**
	        * @param {number} k
	        * @return {number}
	        */
	        exponentialOut: function (k) {
	            return k === 1 ? 1 : 1 - Math.pow(2, -10 * k);
	        },
	        /**
	        * @param {number} k
	        * @return {number}
	        */
	        exponentialInOut: function (k) {
	            if (k === 0) {
	                return 0;
	            }
	            if (k === 1) {
	                return 1;
	            }
	            if ((k *= 2) < 1) {
	                return 0.5 * Math.pow(1024, k - 1);
	            }
	            return 0.5 * (-Math.pow(2, -10 * (k - 1)) + 2);
	        },

	        // 圆形曲线的缓动（sqrt(1-t^2)）
	        /**
	        * @param {number} k
	        * @return {number}
	        */
	        circularIn: function (k) {
	            return 1 - Math.sqrt(1 - k * k);
	        },
	        /**
	        * @param {number} k
	        * @return {number}
	        */
	        circularOut: function (k) {
	            return Math.sqrt(1 - (--k * k));
	        },
	        /**
	        * @param {number} k
	        * @return {number}
	        */
	        circularInOut: function (k) {
	            if ((k *= 2) < 1) {
	                return -0.5 * (Math.sqrt(1 - k * k) - 1);
	            }
	            return 0.5 * (Math.sqrt(1 - (k -= 2) * k) + 1);
	        },

	        // 创建类似于弹簧在停止前来回振荡的动画
	        /**
	        * @param {number} k
	        * @return {number}
	        */
	        elasticIn: function (k) {
	            var s;
	            var a = 0.1;
	            var p = 0.4;
	            if (k === 0) {
	                return 0;
	            }
	            if (k === 1) {
	                return 1;
	            }
	            if (!a || a < 1) {
	                a = 1; s = p / 4;
	            }
	            else {
	                s = p * Math.asin(1 / a) / (2 * Math.PI);
	            }
	            return -(a * Math.pow(2, 10 * (k -= 1)) *
	                        Math.sin((k - s) * (2 * Math.PI) / p));
	        },
	        /**
	        * @param {number} k
	        * @return {number}
	        */
	        elasticOut: function (k) {
	            var s;
	            var a = 0.1;
	            var p = 0.4;
	            if (k === 0) {
	                return 0;
	            }
	            if (k === 1) {
	                return 1;
	            }
	            if (!a || a < 1) {
	                a = 1; s = p / 4;
	            }
	            else {
	                s = p * Math.asin(1 / a) / (2 * Math.PI);
	            }
	            return (a * Math.pow(2, -10 * k) *
	                    Math.sin((k - s) * (2 * Math.PI) / p) + 1);
	        },
	        /**
	        * @param {number} k
	        * @return {number}
	        */
	        elasticInOut: function (k) {
	            var s;
	            var a = 0.1;
	            var p = 0.4;
	            if (k === 0) {
	                return 0;
	            }
	            if (k === 1) {
	                return 1;
	            }
	            if (!a || a < 1) {
	                a = 1; s = p / 4;
	            }
	            else {
	                s = p * Math.asin(1 / a) / (2 * Math.PI);
	            }
	            if ((k *= 2) < 1) {
	                return -0.5 * (a * Math.pow(2, 10 * (k -= 1))
	                    * Math.sin((k - s) * (2 * Math.PI) / p));
	            }
	            return a * Math.pow(2, -10 * (k -= 1))
	                    * Math.sin((k - s) * (2 * Math.PI) / p) * 0.5 + 1;

	        },

	        // 在某一动画开始沿指示的路径进行动画处理前稍稍收回该动画的移动
	        /**
	        * @param {number} k
	        * @return {number}
	        */
	        backIn: function (k) {
	            var s = 1.70158;
	            return k * k * ((s + 1) * k - s);
	        },
	        /**
	        * @param {number} k
	        * @return {number}
	        */
	        backOut: function (k) {
	            var s = 1.70158;
	            return --k * k * ((s + 1) * k + s) + 1;
	        },
	        /**
	        * @param {number} k
	        * @return {number}
	        */
	        backInOut: function (k) {
	            var s = 1.70158 * 1.525;
	            if ((k *= 2) < 1) {
	                return 0.5 * (k * k * ((s + 1) * k - s));
	            }
	            return 0.5 * ((k -= 2) * k * ((s + 1) * k + s) + 2);
	        },

	        // 创建弹跳效果
	        /**
	        * @param {number} k
	        * @return {number}
	        */
	        bounceIn: function (k) {
	            return 1 - easing.bounceOut(1 - k);
	        },
	        /**
	        * @param {number} k
	        * @return {number}
	        */
	        bounceOut: function (k) {
	            if (k < (1 / 2.75)) {
	                return 7.5625 * k * k;
	            }
	            else if (k < (2 / 2.75)) {
	                return 7.5625 * (k -= (1.5 / 2.75)) * k + 0.75;
	            }
	            else if (k < (2.5 / 2.75)) {
	                return 7.5625 * (k -= (2.25 / 2.75)) * k + 0.9375;
	            }
	            else {
	                return 7.5625 * (k -= (2.625 / 2.75)) * k + 0.984375;
	            }
	        },
	        /**
	        * @param {number} k
	        * @return {number}
	        */
	        bounceInOut: function (k) {
	            if (k < 0.5) {
	                return easing.bounceIn(k * 2) * 0.5;
	            }
	            return easing.bounceOut(k * 2 - 1) * 0.5 + 0.5;
	        }
	    };

	    module.exports = easing;




/***/ },
/* 50 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * @module zrender/tool/color
	 */


	    var LRU = __webpack_require__(45);

	    var kCSSColorTable = {
	        'transparent': [0,0,0,0], 'aliceblue': [240,248,255,1],
	        'antiquewhite': [250,235,215,1], 'aqua': [0,255,255,1],
	        'aquamarine': [127,255,212,1], 'azure': [240,255,255,1],
	        'beige': [245,245,220,1], 'bisque': [255,228,196,1],
	        'black': [0,0,0,1], 'blanchedalmond': [255,235,205,1],
	        'blue': [0,0,255,1], 'blueviolet': [138,43,226,1],
	        'brown': [165,42,42,1], 'burlywood': [222,184,135,1],
	        'cadetblue': [95,158,160,1], 'chartreuse': [127,255,0,1],
	        'chocolate': [210,105,30,1], 'coral': [255,127,80,1],
	        'cornflowerblue': [100,149,237,1], 'cornsilk': [255,248,220,1],
	        'crimson': [220,20,60,1], 'cyan': [0,255,255,1],
	        'darkblue': [0,0,139,1], 'darkcyan': [0,139,139,1],
	        'darkgoldenrod': [184,134,11,1], 'darkgray': [169,169,169,1],
	        'darkgreen': [0,100,0,1], 'darkgrey': [169,169,169,1],
	        'darkkhaki': [189,183,107,1], 'darkmagenta': [139,0,139,1],
	        'darkolivegreen': [85,107,47,1], 'darkorange': [255,140,0,1],
	        'darkorchid': [153,50,204,1], 'darkred': [139,0,0,1],
	        'darksalmon': [233,150,122,1], 'darkseagreen': [143,188,143,1],
	        'darkslateblue': [72,61,139,1], 'darkslategray': [47,79,79,1],
	        'darkslategrey': [47,79,79,1], 'darkturquoise': [0,206,209,1],
	        'darkviolet': [148,0,211,1], 'deeppink': [255,20,147,1],
	        'deepskyblue': [0,191,255,1], 'dimgray': [105,105,105,1],
	        'dimgrey': [105,105,105,1], 'dodgerblue': [30,144,255,1],
	        'firebrick': [178,34,34,1], 'floralwhite': [255,250,240,1],
	        'forestgreen': [34,139,34,1], 'fuchsia': [255,0,255,1],
	        'gainsboro': [220,220,220,1], 'ghostwhite': [248,248,255,1],
	        'gold': [255,215,0,1], 'goldenrod': [218,165,32,1],
	        'gray': [128,128,128,1], 'green': [0,128,0,1],
	        'greenyellow': [173,255,47,1], 'grey': [128,128,128,1],
	        'honeydew': [240,255,240,1], 'hotpink': [255,105,180,1],
	        'indianred': [205,92,92,1], 'indigo': [75,0,130,1],
	        'ivory': [255,255,240,1], 'khaki': [240,230,140,1],
	        'lavender': [230,230,250,1], 'lavenderblush': [255,240,245,1],
	        'lawngreen': [124,252,0,1], 'lemonchiffon': [255,250,205,1],
	        'lightblue': [173,216,230,1], 'lightcoral': [240,128,128,1],
	        'lightcyan': [224,255,255,1], 'lightgoldenrodyellow': [250,250,210,1],
	        'lightgray': [211,211,211,1], 'lightgreen': [144,238,144,1],
	        'lightgrey': [211,211,211,1], 'lightpink': [255,182,193,1],
	        'lightsalmon': [255,160,122,1], 'lightseagreen': [32,178,170,1],
	        'lightskyblue': [135,206,250,1], 'lightslategray': [119,136,153,1],
	        'lightslategrey': [119,136,153,1], 'lightsteelblue': [176,196,222,1],
	        'lightyellow': [255,255,224,1], 'lime': [0,255,0,1],
	        'limegreen': [50,205,50,1], 'linen': [250,240,230,1],
	        'magenta': [255,0,255,1], 'maroon': [128,0,0,1],
	        'mediumaquamarine': [102,205,170,1], 'mediumblue': [0,0,205,1],
	        'mediumorchid': [186,85,211,1], 'mediumpurple': [147,112,219,1],
	        'mediumseagreen': [60,179,113,1], 'mediumslateblue': [123,104,238,1],
	        'mediumspringgreen': [0,250,154,1], 'mediumturquoise': [72,209,204,1],
	        'mediumvioletred': [199,21,133,1], 'midnightblue': [25,25,112,1],
	        'mintcream': [245,255,250,1], 'mistyrose': [255,228,225,1],
	        'moccasin': [255,228,181,1], 'navajowhite': [255,222,173,1],
	        'navy': [0,0,128,1], 'oldlace': [253,245,230,1],
	        'olive': [128,128,0,1], 'olivedrab': [107,142,35,1],
	        'orange': [255,165,0,1], 'orangered': [255,69,0,1],
	        'orchid': [218,112,214,1], 'palegoldenrod': [238,232,170,1],
	        'palegreen': [152,251,152,1], 'paleturquoise': [175,238,238,1],
	        'palevioletred': [219,112,147,1], 'papayawhip': [255,239,213,1],
	        'peachpuff': [255,218,185,1], 'peru': [205,133,63,1],
	        'pink': [255,192,203,1], 'plum': [221,160,221,1],
	        'powderblue': [176,224,230,1], 'purple': [128,0,128,1],
	        'red': [255,0,0,1], 'rosybrown': [188,143,143,1],
	        'royalblue': [65,105,225,1], 'saddlebrown': [139,69,19,1],
	        'salmon': [250,128,114,1], 'sandybrown': [244,164,96,1],
	        'seagreen': [46,139,87,1], 'seashell': [255,245,238,1],
	        'sienna': [160,82,45,1], 'silver': [192,192,192,1],
	        'skyblue': [135,206,235,1], 'slateblue': [106,90,205,1],
	        'slategray': [112,128,144,1], 'slategrey': [112,128,144,1],
	        'snow': [255,250,250,1], 'springgreen': [0,255,127,1],
	        'steelblue': [70,130,180,1], 'tan': [210,180,140,1],
	        'teal': [0,128,128,1], 'thistle': [216,191,216,1],
	        'tomato': [255,99,71,1], 'turquoise': [64,224,208,1],
	        'violet': [238,130,238,1], 'wheat': [245,222,179,1],
	        'white': [255,255,255,1], 'whitesmoke': [245,245,245,1],
	        'yellow': [255,255,0,1], 'yellowgreen': [154,205,50,1]
	    };

	    function clampCssByte(i) {  // Clamp to integer 0 .. 255.
	        i = Math.round(i);  // Seems to be what Chrome does (vs truncation).
	        return i < 0 ? 0 : i > 255 ? 255 : i;
	    }

	    function clampCssAngle(i) {  // Clamp to integer 0 .. 360.
	        i = Math.round(i);  // Seems to be what Chrome does (vs truncation).
	        return i < 0 ? 0 : i > 360 ? 360 : i;
	    }

	    function clampCssFloat(f) {  // Clamp to float 0.0 .. 1.0.
	        return f < 0 ? 0 : f > 1 ? 1 : f;
	    }

	    function parseCssInt(str) {  // int or percentage.
	        if (str.length && str.charAt(str.length - 1) === '%') {
	            return clampCssByte(parseFloat(str) / 100 * 255);
	        }
	        return clampCssByte(parseInt(str, 10));
	    }

	    function parseCssFloat(str) {  // float or percentage.
	        if (str.length && str.charAt(str.length - 1) === '%') {
	            return clampCssFloat(parseFloat(str) / 100);
	        }
	        return clampCssFloat(parseFloat(str));
	    }

	    function cssHueToRgb(m1, m2, h) {
	        if (h < 0) {
	            h += 1;
	        }
	        else if (h > 1) {
	            h -= 1;
	        }

	        if (h * 6 < 1) {
	            return m1 + (m2 - m1) * h * 6;
	        }
	        if (h * 2 < 1) {
	            return m2;
	        }
	        if (h * 3 < 2) {
	            return m1 + (m2 - m1) * (2/3 - h) * 6;
	        }
	        return m1;
	    }

	    function lerp(a, b, p) {
	        return a + (b - a) * p;
	    }

	    function setRgba(out, r, g, b, a) {
	        out[0] = r; out[1] = g; out[2] = b; out[3] = a;
	        return out;
	    }
	    function copyRgba(out, a) {
	        out[0] = a[0]; out[1] = a[1]; out[2] = a[2]; out[3] = a[3];
	        return out;
	    }
	    var colorCache = new LRU(20);
	    var lastRemovedArr = null;
	    function putToCache(colorStr, rgbaArr) {
	        // Reuse removed array
	        if (lastRemovedArr) {
	            copyRgba(lastRemovedArr, rgbaArr);
	        }
	        lastRemovedArr = colorCache.put(colorStr, lastRemovedArr || (rgbaArr.slice()));
	    }
	    /**
	     * @param {string} colorStr
	     * @param {Array.<number>} out
	     * @return {Array.<number>}
	     * @memberOf module:zrender/util/color
	     */
	    function parse(colorStr, rgbaArr) {
	        if (!colorStr) {
	            return;
	        }
	        rgbaArr = rgbaArr || [];

	        var cached = colorCache.get(colorStr);
	        if (cached) {
	            return copyRgba(rgbaArr, cached);
	        }

	        // colorStr may be not string
	        colorStr = colorStr + '';
	        // Remove all whitespace, not compliant, but should just be more accepting.
	        var str = colorStr.replace(/ /g, '').toLowerCase();

	        // Color keywords (and transparent) lookup.
	        if (str in kCSSColorTable) {
	            copyRgba(rgbaArr, kCSSColorTable[str]);
	            putToCache(colorStr, rgbaArr);
	            return rgbaArr;
	        }

	        // #abc and #abc123 syntax.
	        if (str.charAt(0) === '#') {
	            if (str.length === 4) {
	                var iv = parseInt(str.substr(1), 16);  // TODO(deanm): Stricter parsing.
	                if (!(iv >= 0 && iv <= 0xfff)) {
	                    setRgba(rgbaArr, 0, 0, 0, 1);
	                    return;  // Covers NaN.
	                }
	                setRgba(rgbaArr,
	                    ((iv & 0xf00) >> 4) | ((iv & 0xf00) >> 8),
	                    (iv & 0xf0) | ((iv & 0xf0) >> 4),
	                    (iv & 0xf) | ((iv & 0xf) << 4),
	                    1
	                );
	                putToCache(colorStr, rgbaArr);
	                return rgbaArr;
	            }
	            else if (str.length === 7) {
	                var iv = parseInt(str.substr(1), 16);  // TODO(deanm): Stricter parsing.
	                if (!(iv >= 0 && iv <= 0xffffff)) {
	                    setRgba(rgbaArr, 0, 0, 0, 1);
	                    return;  // Covers NaN.
	                }
	                setRgba(rgbaArr,
	                    (iv & 0xff0000) >> 16,
	                    (iv & 0xff00) >> 8,
	                    iv & 0xff,
	                    1
	                );
	                putToCache(colorStr, rgbaArr);
	                return rgbaArr;
	            }

	            return;
	        }
	        var op = str.indexOf('('), ep = str.indexOf(')');
	        if (op !== -1 && ep + 1 === str.length) {
	            var fname = str.substr(0, op);
	            var params = str.substr(op + 1, ep - (op + 1)).split(',');
	            var alpha = 1;  // To allow case fallthrough.
	            switch (fname) {
	                case 'rgba':
	                    if (params.length !== 4) {
	                        setRgba(rgbaArr, 0, 0, 0, 1);
	                        return;
	                    }
	                    alpha = parseCssFloat(params.pop()); // jshint ignore:line
	                // Fall through.
	                case 'rgb':
	                    if (params.length !== 3) {
	                        setRgba(rgbaArr, 0, 0, 0, 1);
	                        return;
	                    }
	                    setRgba(rgbaArr,
	                        parseCssInt(params[0]),
	                        parseCssInt(params[1]),
	                        parseCssInt(params[2]),
	                        alpha
	                    );
	                    putToCache(colorStr, rgbaArr);
	                    return rgbaArr;
	                case 'hsla':
	                    if (params.length !== 4) {
	                        setRgba(rgbaArr, 0, 0, 0, 1);
	                        return;
	                    }
	                    params[3] = parseCssFloat(params[3]);
	                    hsla2rgba(params, rgbaArr);
	                    putToCache(colorStr, rgbaArr);
	                    return rgbaArr;
	                case 'hsl':
	                    if (params.length !== 3) {
	                        setRgba(rgbaArr, 0, 0, 0, 1);
	                        return;
	                    }
	                    hsla2rgba(params, rgbaArr);
	                    putToCache(colorStr, rgbaArr);
	                    return rgbaArr;
	                default:
	                    return;
	            }
	        }

	        setRgba(rgbaArr, 0, 0, 0, 1);
	        return;
	    }

	    /**
	     * @param {Array.<number>} hsla
	     * @param {Array.<number>} rgba
	     * @return {Array.<number>} rgba
	     */
	    function hsla2rgba(hsla, rgba) {
	        var h = (((parseFloat(hsla[0]) % 360) + 360) % 360) / 360;  // 0 .. 1
	        // NOTE(deanm): According to the CSS spec s/l should only be
	        // percentages, but we don't bother and let float or percentage.
	        var s = parseCssFloat(hsla[1]);
	        var l = parseCssFloat(hsla[2]);
	        var m2 = l <= 0.5 ? l * (s + 1) : l + s - l * s;
	        var m1 = l * 2 - m2;

	        rgba = rgba || [];
	        setRgba(rgba,
	            clampCssByte(cssHueToRgb(m1, m2, h + 1 / 3) * 255),
	            clampCssByte(cssHueToRgb(m1, m2, h) * 255),
	            clampCssByte(cssHueToRgb(m1, m2, h - 1 / 3) * 255),
	            1
	        );

	        if (hsla.length === 4) {
	            rgba[3] = hsla[3];
	        }

	        return rgba;
	    }

	    /**
	     * @param {Array.<number>} rgba
	     * @return {Array.<number>} hsla
	     */
	    function rgba2hsla(rgba) {
	        if (!rgba) {
	            return;
	        }

	        // RGB from 0 to 255
	        var R = rgba[0] / 255;
	        var G = rgba[1] / 255;
	        var B = rgba[2] / 255;

	        var vMin = Math.min(R, G, B); // Min. value of RGB
	        var vMax = Math.max(R, G, B); // Max. value of RGB
	        var delta = vMax - vMin; // Delta RGB value

	        var L = (vMax + vMin) / 2;
	        var H;
	        var S;
	        // HSL results from 0 to 1
	        if (delta === 0) {
	            H = 0;
	            S = 0;
	        }
	        else {
	            if (L < 0.5) {
	                S = delta / (vMax + vMin);
	            }
	            else {
	                S = delta / (2 - vMax - vMin);
	            }

	            var deltaR = (((vMax - R) / 6) + (delta / 2)) / delta;
	            var deltaG = (((vMax - G) / 6) + (delta / 2)) / delta;
	            var deltaB = (((vMax - B) / 6) + (delta / 2)) / delta;

	            if (R === vMax) {
	                H = deltaB - deltaG;
	            }
	            else if (G === vMax) {
	                H = (1 / 3) + deltaR - deltaB;
	            }
	            else if (B === vMax) {
	                H = (2 / 3) + deltaG - deltaR;
	            }

	            if (H < 0) {
	                H += 1;
	            }

	            if (H > 1) {
	                H -= 1;
	            }
	        }

	        var hsla = [H * 360, S, L];

	        if (rgba[3] != null) {
	            hsla.push(rgba[3]);
	        }

	        return hsla;
	    }

	    /**
	     * @param {string} color
	     * @param {number} level
	     * @return {string}
	     * @memberOf module:zrender/util/color
	     */
	    function lift(color, level) {
	        var colorArr = parse(color);
	        if (colorArr) {
	            for (var i = 0; i < 3; i++) {
	                if (level < 0) {
	                    colorArr[i] = colorArr[i] * (1 - level) | 0;
	                }
	                else {
	                    colorArr[i] = ((255 - colorArr[i]) * level + colorArr[i]) | 0;
	                }
	            }
	            return stringify(colorArr, colorArr.length === 4 ? 'rgba' : 'rgb');
	        }
	    }

	    /**
	     * @param {string} color
	     * @return {string}
	     * @memberOf module:zrender/util/color
	     */
	    function toHex(color, level) {
	        var colorArr = parse(color);
	        if (colorArr) {
	            return ((1 << 24) + (colorArr[0] << 16) + (colorArr[1] << 8) + (+colorArr[2])).toString(16).slice(1);
	        }
	    }

	    /**
	     * Map value to color. Faster than mapToColor methods because color is represented by rgba array
	     * @param {number} normalizedValue A float between 0 and 1.
	     * @param {Array.<Array.<number>>} colors List of rgba color array
	     * @param {Array.<number>} [out] Mapped gba color array
	     * @return {Array.<number>}
	     */
	    function fastMapToColor(normalizedValue, colors, out) {
	        if (!(colors && colors.length)
	            || !(normalizedValue >= 0 && normalizedValue <= 1)
	        ) {
	            return;
	        }
	        out = out || [0, 0, 0, 0];
	        var value = normalizedValue * (colors.length - 1);
	        var leftIndex = Math.floor(value);
	        var rightIndex = Math.ceil(value);
	        var leftColor = colors[leftIndex];
	        var rightColor = colors[rightIndex];
	        var dv = value - leftIndex;
	        out[0] = clampCssByte(lerp(leftColor[0], rightColor[0], dv));
	        out[1] = clampCssByte(lerp(leftColor[1], rightColor[1], dv));
	        out[2] = clampCssByte(lerp(leftColor[2], rightColor[2], dv));
	        out[3] = clampCssByte(lerp(leftColor[3], rightColor[3], dv));
	        return out;
	    }
	    /**
	     * @param {number} normalizedValue A float between 0 and 1.
	     * @param {Array.<string>} colors Color list.
	     * @param {boolean=} fullOutput Default false.
	     * @return {(string|Object)} Result color. If fullOutput,
	     *                           return {color: ..., leftIndex: ..., rightIndex: ..., value: ...},
	     * @memberOf module:zrender/util/color
	     */
	    function mapToColor(normalizedValue, colors, fullOutput) {
	        if (!(colors && colors.length)
	            || !(normalizedValue >= 0 && normalizedValue <= 1)
	        ) {
	            return;
	        }

	        var value = normalizedValue * (colors.length - 1);
	        var leftIndex = Math.floor(value);
	        var rightIndex = Math.ceil(value);
	        var leftColor = parse(colors[leftIndex]);
	        var rightColor = parse(colors[rightIndex]);
	        var dv = value - leftIndex;

	        var color = stringify(
	            [
	                clampCssByte(lerp(leftColor[0], rightColor[0], dv)),
	                clampCssByte(lerp(leftColor[1], rightColor[1], dv)),
	                clampCssByte(lerp(leftColor[2], rightColor[2], dv)),
	                clampCssFloat(lerp(leftColor[3], rightColor[3], dv))
	            ],
	            'rgba'
	        );

	        return fullOutput
	            ? {
	                color: color,
	                leftIndex: leftIndex,
	                rightIndex: rightIndex,
	                value: value
	            }
	            : color;
	    }

	    /**
	     * @param {string} color
	     * @param {number=} h 0 ~ 360, ignore when null.
	     * @param {number=} s 0 ~ 1, ignore when null.
	     * @param {number=} l 0 ~ 1, ignore when null.
	     * @return {string} Color string in rgba format.
	     * @memberOf module:zrender/util/color
	     */
	    function modifyHSL(color, h, s, l) {
	        color = parse(color);

	        if (color) {
	            color = rgba2hsla(color);
	            h != null && (color[0] = clampCssAngle(h));
	            s != null && (color[1] = parseCssFloat(s));
	            l != null && (color[2] = parseCssFloat(l));

	            return stringify(hsla2rgba(color), 'rgba');
	        }
	    }

	    /**
	     * @param {string} color
	     * @param {number=} alpha 0 ~ 1
	     * @return {string} Color string in rgba format.
	     * @memberOf module:zrender/util/color
	     */
	    function modifyAlpha(color, alpha) {
	        color = parse(color);

	        if (color && alpha != null) {
	            color[3] = clampCssFloat(alpha);
	            return stringify(color, 'rgba');
	        }
	    }

	    /**
	     * @param {Array.<string>} colors Color list.
	     * @param {string} type 'rgba', 'hsva', ...
	     * @return {string} Result color.
	     */
	    function stringify(arrColor, type) {
	        var colorStr = arrColor[0] + ',' + arrColor[1] + ',' + arrColor[2];
	        if (type === 'rgba' || type === 'hsva' || type === 'hsla') {
	            colorStr += ',' + arrColor[3];
	        }
	        return type + '(' + colorStr + ')';
	    }

	    module.exports = {
	        parse: parse,
	        lift: lift,
	        toHex: toHex,
	        fastMapToColor: fastMapToColor,
	        mapToColor: mapToColor,
	        modifyHSL: modifyHSL,
	        modifyAlpha: modifyAlpha,
	        stringify: stringify
	    };




/***/ },
/* 51 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';


	    var StaticGeometry = __webpack_require__(32);
	    var glMatrix = __webpack_require__(15);
	    var vec3 = glMatrix.vec3;
	    var vec2 = glMatrix.vec2;
	    var BoundingBox = __webpack_require__(13);

	    /**
	     * @constructor qtek.geometry.Sphere
	     * @extends qtek.StaticGeometry
	     * @param {Object} [opt]
	     * @param {number} [widthSegments]
	     * @param {number} [heightSegments]
	     * @param {number} [phiStart]
	     * @param {number} [phiLength]
	     * @param {number} [thetaStart]
	     * @param {number} [thetaLength]
	     * @param {number} [radius]
	     */
	    var Sphere = StaticGeometry.extend(
	    /** @lends qtek.geometry.Sphere# */
	    {
	        /**
	         * @type {number}
	         */
	        widthSegments: 20,
	        /**
	         * @type {number}
	         */
	        heightSegments: 20,

	        /**
	         * @type {number}
	         */
	        phiStart: 0,
	        /**
	         * @type {number}
	         */
	        phiLength: Math.PI * 2,

	        /**
	         * @type {number}
	         */
	        thetaStart: 0,
	        /**
	         * @type {number}
	         */
	        thetaLength: Math.PI,

	        /**
	         * @type {number}
	         */
	        radius: 1

	    }, function() {
	        this.build();
	    },
	    /** @lends qtek.geometry.Sphere.prototype */
	    {
	        /**
	         * Build sphere geometry
	         */
	        build: function() {
	            var positions = [];
	            var texcoords = [];
	            var normals = [];
	            var faces = [];

	            var x, y, z,
	                u, v,
	                i, j;
	            var normal;

	            var heightSegments = this.heightSegments;
	            var widthSegments = this.widthSegments;
	            var radius = this.radius;
	            var phiStart = this.phiStart;
	            var phiLength = this.phiLength;
	            var thetaStart = this.thetaStart;
	            var thetaLength = this.thetaLength;
	            var radius = this.radius;

	            for (j = 0; j <= heightSegments; j ++) {
	                for (i = 0; i <= widthSegments; i ++) {
	                    u = i / widthSegments;
	                    v = j / heightSegments;

	                    // X axis is inverted so texture can be mapped from left to right
	                    x = -radius * Math.cos(phiStart + u * phiLength) * Math.sin(thetaStart + v * thetaLength);
	                    y = radius * Math.cos(thetaStart + v * thetaLength);
	                    z = radius * Math.sin(phiStart + u * phiLength) * Math.sin(thetaStart + v * thetaLength);

	                    positions.push(vec3.fromValues(x, y, z));
	                    texcoords.push(vec2.fromValues(u, v));

	                    normal = vec3.fromValues(x, y, z);
	                    vec3.normalize(normal, normal);
	                    normals.push(normal);
	                }
	            }

	            var i1, i2, i3, i4;

	            var len = widthSegments + 1;

	            for (j = 0; j < heightSegments; j ++) {
	                for (i = 0; i < widthSegments; i ++) {
	                    i2 = j * len + i;
	                    i1 = (j * len + i + 1);
	                    i4 = (j + 1) * len + i + 1;
	                    i3 = (j + 1) * len + i;

	                    faces.push(vec3.fromValues(i1, i2, i4));
	                    faces.push(vec3.fromValues(i2, i3, i4));
	                }
	            }

	            var attributes = this.attributes;

	            attributes.position.fromArray(positions);
	            attributes.texcoord0.fromArray(texcoords);
	            attributes.normal.fromArray(normals);

	            this.initFaceFromArray(faces);


	            this.boundingBox = new BoundingBox();
	            this.boundingBox.max.set(radius, radius, radius);
	            this.boundingBox.min.set(-radius, -radius, -radius);
	        }
	    });

	    module.exports = Sphere;


/***/ },
/* 52 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';


	    var StaticGeometry = __webpack_require__(32);
	    var BoundingBox = __webpack_require__(13);

	    /**
	     * @constructor qtek.geometry.Plane
	     * @extends qtek.StaticGeometry
	     * @param {Object} [opt]
	     * @param {number} [opt.widthSegments]
	     * @param {number} [opt.heightSegments]
	     */
	    var Plane = StaticGeometry.extend(
	    /** @lends qtek.geometry.Plane# */
	    {
	        /**
	         * @type {number}
	         */
	        widthSegments: 1,
	        /**
	         * @type {number}
	         */
	        heightSegments: 1
	    }, function() {
	        this.build();
	    },
	    /** @lends qtek.geometry.Plane.prototype */
	    {
	        /**
	         * Build plane geometry
	         */
	        build: function() {
	            var heightSegments = this.heightSegments;
	            var widthSegments = this.widthSegments;
	            var attributes = this.attributes;
	            var positions = [];
	            var texcoords = [];
	            var normals = [];
	            var faces = [];

	            for (var y = 0; y <= heightSegments; y++) {
	                var t = y / heightSegments;
	                for (var x = 0; x <= widthSegments; x++) {
	                    var s = x / widthSegments;

	                    positions.push([2 * s - 1, 2 * t - 1, 0]);
	                    if (texcoords) {
	                        texcoords.push([s, t]);
	                    }
	                    if (normals) {
	                        normals.push([0, 0, 1]);
	                    }
	                    if (x < widthSegments && y < heightSegments) {
	                        var i = x + y * (widthSegments + 1);
	                        faces.push([i, i + 1, i + widthSegments + 1]);
	                        faces.push([i + widthSegments + 1, i + 1, i + widthSegments + 2]);
	                    }
	                }
	            }

	            attributes.position.fromArray(positions);
	            attributes.texcoord0.fromArray(texcoords);
	            attributes.normal.fromArray(normals);

	            this.initFaceFromArray(faces);

	            this.boundingBox = new BoundingBox();
	            this.boundingBox.min.set(-1, -1, 0);
	            this.boundingBox.max.set(1, 1, 0);
	        }
	    });

	    module.exports = Plane;


/***/ },
/* 53 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';


	    var StaticGeometry = __webpack_require__(32);
	    var Plane = __webpack_require__(52);
	    var Matrix4 = __webpack_require__(16);
	    var Vector3 = __webpack_require__(14);
	    var BoundingBox = __webpack_require__(13);
	    var vendor = __webpack_require__(12);

	    var planeMatrix = new Matrix4();

	    /**
	     * @constructor qtek.geometry.Cube
	     * @extends qtek.StaticGeometry
	     * @param {Object} [opt]
	     * @param {number} [opt.widthSegments]
	     * @param {number} [opt.heightSegments]
	     * @param {number} [opt.depthSegments]
	     * @param {boolean} [opt.inside]
	     */
	    var Cube = StaticGeometry.extend(
	    /**@lends qtek.geometry.Cube# */
	    {
	        /**
	         * @type {number}
	         */
	        widthSegments: 1,
	        /**
	         * @type {number}
	         */
	        heightSegments: 1,
	        /**
	         * @type {number}
	         */
	        depthSegments: 1,
	        /**
	         * @type {boolean}
	         */
	        inside: false
	    }, function() {
	        this.build();
	    },
	    /** @lends qtek.geometry.Cube.prototype */
	    {
	        /**
	         * Build cube geometry
	         */
	        build: function() {

	            var planes = {
	                'px': createPlane('px', this.depthSegments, this.heightSegments),
	                'nx': createPlane('nx', this.depthSegments, this.heightSegments),
	                'py': createPlane('py', this.widthSegments, this.depthSegments),
	                'ny': createPlane('ny', this.widthSegments, this.depthSegments),
	                'pz': createPlane('pz', this.widthSegments, this.heightSegments),
	                'nz': createPlane('nz', this.widthSegments, this.heightSegments),
	            };

	            var attrList = ['position', 'texcoord0', 'normal'];
	            var vertexNumber = 0;
	            var faceNumber = 0;
	            for (var pos in planes) {
	                vertexNumber += planes[pos].vertexCount;
	                faceNumber += planes[pos].faces.length;
	            }
	            for (var k = 0; k < attrList.length; k++) {
	                this.attributes[attrList[k]].init(vertexNumber);
	            }
	            this.faces = new vendor.Uint16Array(faceNumber);
	            var faceOffset = 0;
	            var vertexOffset = 0;
	            for (var pos in planes) {
	                var plane = planes[pos];
	                for (var k = 0; k < attrList.length; k++) {
	                    var attrName = attrList[k];
	                    var attrArray = plane.attributes[attrName].value;
	                    var attrSize = plane.attributes[attrName].size;
	                    var isNormal = attrName === 'normal';
	                    for (var i = 0; i < attrArray.length; i++) {
	                        var value = attrArray[i];
	                        if (this.inside && isNormal) {
	                            value = -value;
	                        }
	                        this.attributes[attrName].value[i + attrSize * vertexOffset] = value;
	                    }
	                }
	                for (var i = 0; i < plane.faces.length; i++) {
	                    this.faces[i + faceOffset] = vertexOffset + plane.faces[i];
	                }
	                faceOffset += plane.faces.length;
	                vertexOffset += plane.vertexCount;
	            }

	            this.boundingBox = new BoundingBox();
	            this.boundingBox.max.set(1, 1, 1);
	            this.boundingBox.min.set(-1, -1, -1);
	        }
	    });

	    function createPlane(pos, widthSegments, heightSegments) {

	        planeMatrix.identity();

	        var plane = new Plane({
	            widthSegments: widthSegments,
	            heightSegments: heightSegments
	        });

	        switch(pos) {
	            case 'px':
	                Matrix4.translate(planeMatrix, planeMatrix, Vector3.POSITIVE_X);
	                Matrix4.rotateY(planeMatrix, planeMatrix, Math.PI / 2);
	                break;
	            case 'nx':
	                Matrix4.translate(planeMatrix, planeMatrix, Vector3.NEGATIVE_X);
	                Matrix4.rotateY(planeMatrix, planeMatrix, -Math.PI / 2);
	                break;
	            case 'py':
	                Matrix4.translate(planeMatrix, planeMatrix, Vector3.POSITIVE_Y);
	                Matrix4.rotateX(planeMatrix, planeMatrix, -Math.PI / 2);
	                break;
	            case 'ny':
	                Matrix4.translate(planeMatrix, planeMatrix, Vector3.NEGATIVE_Y);
	                Matrix4.rotateX(planeMatrix, planeMatrix, Math.PI / 2);
	                break;
	            case 'pz':
	                Matrix4.translate(planeMatrix, planeMatrix, Vector3.POSITIVE_Z);
	                break;
	            case 'nz':
	                Matrix4.translate(planeMatrix, planeMatrix, Vector3.NEGATIVE_Z);
	                Matrix4.rotateY(planeMatrix, planeMatrix, Math.PI);
	                break;
	        }
	        plane.applyTransform(planeMatrix);
	        return plane;
	    }

	    module.exports = Cube;


/***/ },
/* 54 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';


	    var Light = __webpack_require__(44);

	    /**
	     * @constructor qtek.light.Ambient
	     * @extends qtek.Light
	     */
	    var AmbientLight = Light.extend({

	        castShadow: false

	    }, {

	        type: 'AMBIENT_LIGHT',

	        uniformTemplates: {
	            ambientLightColor: {
	                type: '3f',
	                value: function(instance) {
	                    var color = instance.color;
	                    var intensity = instance.intensity;
	                    return [color[0]*intensity, color[1]*intensity, color[2]*intensity];
	                }
	            }
	        }
	        /**
	         * @method
	         * @name clone
	         * @return {qtek.light.Ambient}
	         * @memberOf qtek.light.Ambient.prototype
	         */
	    });

	    module.exports = AmbientLight;


/***/ },
/* 55 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';


	    var Light = __webpack_require__(44);
	    var Vector3 = __webpack_require__(14);

	    /**
	     * @constructor qtek.light.Directional
	     * @extends qtek.Light
	     *
	     * @example
	     *     var light = new qtek.light.Directional({
	     *         intensity: 0.5,
	     *         color: [1.0, 0.0, 0.0]
	     *     });
	     *     light.position.set(10, 10, 10);
	     *     light.lookAt(qtek.math.Vector3.ZERO);
	     *     scene.add(light);
	     */
	    var DirectionalLight = Light.extend(
	    /** @lends qtek.light.Directional# */
	    {
	        /**
	         * @type {number}
	         */
	        shadowBias: 0.001,
	        /**
	         * @type {number}
	         */
	        shadowSlopeScale: 2.0,
	        /**
	         * Shadow cascade.
	         * Use PSSM technique when it is larger than 1 and have a unique directional light in scene.
	         * @type {number}
	         */
	        shadowCascade: 1,

	        /**
	         * Available when shadowCascade is larger than 1 and have a unique directional light in scene.
	         * @type {number}
	         */
	        cascadeSplitLogFactor: 0.2
	    }, {

	        type: 'DIRECTIONAL_LIGHT',

	        uniformTemplates: {
	            directionalLightDirection: {
	                type: '3f',
	                value: function (instance) {
	                    instance.__dir = instance.__dir || new Vector3();
	                    // Direction is target to eye
	                    return instance.__dir.copy(instance.worldTransform.z).negate()._array;
	                }
	            },
	            directionalLightColor: {
	                type: '3f',
	                value: function (instance) {
	                    var color = instance.color;
	                    var intensity = instance.intensity;
	                    return [color[0] * intensity, color[1] * intensity, color[2] * intensity];
	                }
	            }
	        },
	        /**
	         * @return {qtek.light.Directional}
	         * @memberOf qtek.light.Directional.prototype
	         */
	        clone: function () {
	            var light = Light.prototype.clone.call(this);
	            light.shadowBias = this.shadowBias;
	            light.shadowSlopeScale = this.shadowSlopeScale;
	            return light;
	        }
	    });

	    module.exports = DirectionalLight;


/***/ },
/* 56 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';


	    var Light = __webpack_require__(44);

	    /**
	     * @constructor qtek.light.Point
	     * @extends qtek.Light
	     */
	    var PointLight = Light.extend(
	    /** @lends qtek.light.Point# */
	    {
	        /**
	         * @type {number}
	         */
	        range: 100,

	        /**
	         * @type {number}
	         */
	        castShadow: false
	    }, {

	        type: 'POINT_LIGHT',

	        uniformTemplates: {
	            pointLightPosition: {
	                type: '3f',
	                value: function(instance) {
	                    return instance.getWorldPosition()._array;
	                }
	            },
	            pointLightRange: {
	                type: '1f',
	                value: function(instance) {
	                    return instance.range;
	                }
	            },
	            pointLightColor: {
	                type: '3f',
	                value: function(instance) {
	                    var color = instance.color,
	                        intensity = instance.intensity;
	                    return [ color[0]*intensity, color[1]*intensity, color[2]*intensity ];
	                }
	            }
	        },
	        /**
	         * @return {qtek.light.Point}
	         * @memberOf qtek.light.Point.prototype
	         */
	        clone: function() {
	            var light = Light.prototype.clone.call(this);
	            light.range = this.range;
	            return light;
	        }
	    });

	    module.exports = PointLight;


/***/ },
/* 57 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';


	    var Light = __webpack_require__(44);
	    var Vector3 = __webpack_require__(14);

	    /**
	     * @constructor qtek.light.Spot
	     * @extends qtek.Light
	     */
	    var SpotLight = Light.extend(
	    /**@lends qtek.light.Spot */
	    {
	        /**
	         * @type {number}
	         */
	        range: 20,
	        /**
	         * @type {number}
	         */
	        umbraAngle: 30,
	        /**
	         * @type {number}
	         */
	        penumbraAngle: 45,
	        /**
	         * @type {number}
	         */
	        falloffFactor: 2.0,
	        /**
	         * @type {number}
	         */
	        shadowBias: 0.0002,
	        /**
	         * @type {number}
	         */
	        shadowSlopeScale: 2.0
	    },{

	        type: 'SPOT_LIGHT',

	        uniformTemplates: {
	            spotLightPosition: {
	                type: '3f',
	                value: function (instance) {
	                    return instance.getWorldPosition()._array;
	                }
	            },
	            spotLightRange: {
	                type: '1f',
	                value: function (instance) {
	                    return instance.range;
	                }
	            },
	            spotLightUmbraAngleCosine: {
	                type: '1f',
	                value: function (instance) {
	                    return Math.cos(instance.umbraAngle * Math.PI / 180);
	                }
	            },
	            spotLightPenumbraAngleCosine: {
	                type: '1f',
	                value: function (instance) {
	                    return Math.cos(instance.penumbraAngle * Math.PI / 180);
	                }
	            },
	            spotLightFalloffFactor: {
	                type: '1f',
	                value: function (instance) {
	                    return instance.falloffFactor;
	                }
	            },
	            spotLightDirection: {
	                type: '3f',
	                value: function (instance) {
	                    instance.__dir = instance.__dir || new Vector3();
	                    // Direction is target to eye
	                    return instance.__dir.copy(instance.worldTransform.z).negate()._array;
	                }
	            },
	            spotLightColor: {
	                type: '3f',
	                value: function (instance) {
	                    var color = instance.color;
	                    var intensity = instance.intensity;
	                    return [color[0] * intensity, color[1] * intensity, color[2] * intensity];
	                }
	            }
	        },
	        /**
	         * @return {qtek.light.Spot}
	         * @memberOf qtek.light.Spot.prototype
	         */
	        clone: function () {
	            var light = Light.prototype.clone.call(this);
	            light.range = this.range;
	            light.umbraAngle = this.umbraAngle;
	            light.penumbraAngle = this.penumbraAngle;
	            light.falloffFactor = this.falloffFactor;
	            light.shadowBias = this.shadowBias;
	            light.shadowSlopeScale = this.shadowSlopeScale;
	            return light;
	        }
	    });

	    module.exports = SpotLight;


/***/ },
/* 58 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';


	    var glMatrix = __webpack_require__(15);
	    var vec4 = glMatrix.vec4;

	    /**
	     * @constructor
	     * @alias qtek.math.Vector4
	     * @param {number} x
	     * @param {number} y
	     * @param {number} z
	     * @param {number} w
	     */
	    var Vector4 = function(x, y, z, w) {

	        x = x || 0;
	        y = y || 0;
	        z = z || 0;
	        w = w || 0;

	        /**
	         * Storage of Vector4, read and write of x, y, z, w will change the values in _array
	         * All methods also operate on the _array instead of x, y, z, w components
	         * @name _array
	         * @type {Float32Array}
	         */
	        this._array = vec4.fromValues(x, y, z, w);

	        /**
	         * Dirty flag is used by the Node to determine
	         * if the matrix is updated to latest
	         * @name _dirty
	         * @type {boolean}
	         */
	        this._dirty = true;
	    };

	    Vector4.prototype = {

	        constructor: Vector4,

	        /**
	         * Add b to self
	         * @param  {qtek.math.Vector4} b
	         * @return {qtek.math.Vector4}
	         */
	        add: function(b) {
	            vec4.add(this._array, this._array, b._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Set x, y and z components
	         * @param  {number}  x
	         * @param  {number}  y
	         * @param  {number}  z
	         * @param  {number}  w
	         * @return {qtek.math.Vector4}
	         */
	        set: function(x, y, z, w) {
	            this._array[0] = x;
	            this._array[1] = y;
	            this._array[2] = z;
	            this._array[3] = w;
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Set x, y, z and w components from array
	         * @param  {Float32Array|number[]} arr
	         * @return {qtek.math.Vector4}
	         */
	        setArray: function(arr) {
	            this._array[0] = arr[0];
	            this._array[1] = arr[1];
	            this._array[2] = arr[2];
	            this._array[3] = arr[3];

	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Clone a new Vector4
	         * @return {qtek.math.Vector4}
	         */
	        clone: function() {
	            return new Vector4(this.x, this.y, this.z, this.w);
	        },

	        /**
	         * Copy from b
	         * @param  {qtek.math.Vector4} b
	         * @return {qtek.math.Vector4}
	         */
	        copy: function(b) {
	            vec4.copy(this._array, b._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Alias for distance
	         * @param  {qtek.math.Vector4} b
	         * @return {number}
	         */
	        dist: function(b) {
	            return vec4.dist(this._array, b._array);
	        },

	        /**
	         * Distance between self and b
	         * @param  {qtek.math.Vector4} b
	         * @return {number}
	         */
	        distance: function(b) {
	            return vec4.distance(this._array, b._array);
	        },

	        /**
	         * Alias for divide
	         * @param  {qtek.math.Vector4} b
	         * @return {qtek.math.Vector4}
	         */
	        div: function(b) {
	            vec4.div(this._array, this._array, b._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Divide self by b
	         * @param  {qtek.math.Vector4} b
	         * @return {qtek.math.Vector4}
	         */
	        divide: function(b) {
	            vec4.divide(this._array, this._array, b._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Dot product of self and b
	         * @param  {qtek.math.Vector4} b
	         * @return {number}
	         */
	        dot: function(b) {
	            return vec4.dot(this._array, b._array);
	        },

	        /**
	         * Alias of length
	         * @return {number}
	         */
	        len: function() {
	            return vec4.len(this._array);
	        },

	        /**
	         * Calculate the length
	         * @return {number}
	         */
	        length: function() {
	            return vec4.length(this._array);
	        },
	        /**
	         * Linear interpolation between a and b
	         * @param  {qtek.math.Vector4} a
	         * @param  {qtek.math.Vector4} b
	         * @param  {number}  t
	         * @return {qtek.math.Vector4}
	         */
	        lerp: function(a, b, t) {
	            vec4.lerp(this._array, a._array, b._array, t);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Minimum of self and b
	         * @param  {qtek.math.Vector4} b
	         * @return {qtek.math.Vector4}
	         */
	        min: function(b) {
	            vec4.min(this._array, this._array, b._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Maximum of self and b
	         * @param  {qtek.math.Vector4} b
	         * @return {qtek.math.Vector4}
	         */
	        max: function(b) {
	            vec4.max(this._array, this._array, b._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Alias for multiply
	         * @param  {qtek.math.Vector4} b
	         * @return {qtek.math.Vector4}
	         */
	        mul: function(b) {
	            vec4.mul(this._array, this._array, b._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Mutiply self and b
	         * @param  {qtek.math.Vector4} b
	         * @return {qtek.math.Vector4}
	         */
	        multiply: function(b) {
	            vec4.multiply(this._array, this._array, b._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Negate self
	         * @return {qtek.math.Vector4}
	         */
	        negate: function() {
	            vec4.negate(this._array, this._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Normalize self
	         * @return {qtek.math.Vector4}
	         */
	        normalize: function() {
	            vec4.normalize(this._array, this._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Generate random x, y, z, w components with a given scale
	         * @param  {number} scale
	         * @return {qtek.math.Vector4}
	         */
	        random: function(scale) {
	            vec4.random(this._array, scale);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Scale self
	         * @param  {number}  scale
	         * @return {qtek.math.Vector4}
	         */
	        scale: function(s) {
	            vec4.scale(this._array, this._array, s);
	            this._dirty = true;
	            return this;
	        },
	        /**
	         * Scale b and add to self
	         * @param  {qtek.math.Vector4} b
	         * @param  {number}  scale
	         * @return {qtek.math.Vector4}
	         */
	        scaleAndAdd: function(b, s) {
	            vec4.scaleAndAdd(this._array, this._array, b._array, s);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Alias for squaredDistance
	         * @param  {qtek.math.Vector4} b
	         * @return {number}
	         */
	        sqrDist: function(b) {
	            return vec4.sqrDist(this._array, b._array);
	        },

	        /**
	         * Squared distance between self and b
	         * @param  {qtek.math.Vector4} b
	         * @return {number}
	         */
	        squaredDistance: function(b) {
	            return vec4.squaredDistance(this._array, b._array);
	        },

	        /**
	         * Alias for squaredLength
	         * @return {number}
	         */
	        sqrLen: function() {
	            return vec4.sqrLen(this._array);
	        },

	        /**
	         * Squared length of self
	         * @return {number}
	         */
	        squaredLength: function() {
	            return vec4.squaredLength(this._array);
	        },

	        /**
	         * Alias for subtract
	         * @param  {qtek.math.Vector4} b
	         * @return {qtek.math.Vector4}
	         */
	        sub: function(b) {
	            vec4.sub(this._array, this._array, b._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Subtract b from self
	         * @param  {qtek.math.Vector4} b
	         * @return {qtek.math.Vector4}
	         */
	        subtract: function(b) {
	            vec4.subtract(this._array, this._array, b._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Transform self with a Matrix4 m
	         * @param  {qtek.math.Matrix4} m
	         * @return {qtek.math.Vector4}
	         */
	        transformMat4: function(m) {
	            vec4.transformMat4(this._array, this._array, m._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Transform self with a Quaternion q
	         * @param  {qtek.math.Quaternion} q
	         * @return {qtek.math.Vector4}
	         */
	        transformQuat: function(q) {
	            vec4.transformQuat(this._array, this._array, q._array);
	            this._dirty = true;
	            return this;
	        },

	        toString: function() {
	            return '[' + Array.prototype.join.call(this._array, ',') + ']';
	        },

	        toArray: function () {
	            return Array.prototype.slice.call(this._array);
	        }
	    };

	    var defineProperty = Object.defineProperty;
	    // Getter and Setter
	    if (defineProperty) {

	        var proto = Vector4.prototype;
	        /**
	         * @name x
	         * @type {number}
	         * @memberOf qtek.math.Vector4
	         * @instance
	         */
	        defineProperty(proto, 'x', {
	            get: function () {
	                return this._array[0];
	            },
	            set: function (value) {
	                this._array[0] = value;
	                this._dirty = true;
	            }
	        });

	        /**
	         * @name y
	         * @type {number}
	         * @memberOf qtek.math.Vector4
	         * @instance
	         */
	        defineProperty(proto, 'y', {
	            get: function () {
	                return this._array[1];
	            },
	            set: function (value) {
	                this._array[1] = value;
	                this._dirty = true;
	            }
	        });

	        /**
	         * @name z
	         * @type {number}
	         * @memberOf qtek.math.Vector4
	         * @instance
	         */
	        defineProperty(proto, 'z', {
	            get: function () {
	                return this._array[2];
	            },
	            set: function (value) {
	                this._array[2] = value;
	                this._dirty = true;
	            }
	        });

	        /**
	         * @name w
	         * @type {number}
	         * @memberOf qtek.math.Vector4
	         * @instance
	         */
	        defineProperty(proto, 'w', {
	            get: function () {
	                return this._array[3];
	            },
	            set: function (value) {
	                this._array[3] = value;
	                this._dirty = true;
	            }
	        });
	    }

	    // Supply methods that are not in place

	    /**
	     * @param  {qtek.math.Vector4} out
	     * @param  {qtek.math.Vector4} a
	     * @param  {qtek.math.Vector4} b
	     * @return {qtek.math.Vector4}
	     */
	    Vector4.add = function(out, a, b) {
	        vec4.add(out._array, a._array, b._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Vector4} out
	     * @param  {number}  x
	     * @param  {number}  y
	     * @param  {number}  z
	     * @return {qtek.math.Vector4}
	     */
	    Vector4.set = function(out, x, y, z, w) {
	        vec4.set(out._array, x, y, z, w);
	        out._dirty = true;
	    };

	    /**
	     * @param  {qtek.math.Vector4} out
	     * @param  {qtek.math.Vector4} b
	     * @return {qtek.math.Vector4}
	     */
	    Vector4.copy = function(out, b) {
	        vec4.copy(out._array, b._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Vector4} a
	     * @param  {qtek.math.Vector4} b
	     * @return {number}
	     */
	    Vector4.dist = function(a, b) {
	        return vec4.distance(a._array, b._array);
	    };

	    /**
	     * @method
	     * @param  {qtek.math.Vector4} a
	     * @param  {qtek.math.Vector4} b
	     * @return {number}
	     */
	    Vector4.distance = Vector4.dist;

	    /**
	     * @param  {qtek.math.Vector4} out
	     * @param  {qtek.math.Vector4} a
	     * @param  {qtek.math.Vector4} b
	     * @return {qtek.math.Vector4}
	     */
	    Vector4.div = function(out, a, b) {
	        vec4.divide(out._array, a._array, b._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @method
	     * @param  {qtek.math.Vector4} out
	     * @param  {qtek.math.Vector4} a
	     * @param  {qtek.math.Vector4} b
	     * @return {qtek.math.Vector4}
	     */
	    Vector4.divide = Vector4.div;

	    /**
	     * @param  {qtek.math.Vector4} a
	     * @param  {qtek.math.Vector4} b
	     * @return {number}
	     */
	    Vector4.dot = function(a, b) {
	        return vec4.dot(a._array, b._array);
	    };

	    /**
	     * @param  {qtek.math.Vector4} a
	     * @return {number}
	     */
	    Vector4.len = function(b) {
	        return vec4.length(b._array);
	    };

	    // Vector4.length = Vector4.len;

	    /**
	     * @param  {qtek.math.Vector4} out
	     * @param  {qtek.math.Vector4} a
	     * @param  {qtek.math.Vector4} b
	     * @param  {number}  t
	     * @return {qtek.math.Vector4}
	     */
	    Vector4.lerp = function(out, a, b, t) {
	        vec4.lerp(out._array, a._array, b._array, t);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Vector4} out
	     * @param  {qtek.math.Vector4} a
	     * @param  {qtek.math.Vector4} b
	     * @return {qtek.math.Vector4}
	     */
	    Vector4.min = function(out, a, b) {
	        vec4.min(out._array, a._array, b._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Vector4} out
	     * @param  {qtek.math.Vector4} a
	     * @param  {qtek.math.Vector4} b
	     * @return {qtek.math.Vector4}
	     */
	    Vector4.max = function(out, a, b) {
	        vec4.max(out._array, a._array, b._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Vector4} out
	     * @param  {qtek.math.Vector4} a
	     * @param  {qtek.math.Vector4} b
	     * @return {qtek.math.Vector4}
	     */
	    Vector4.mul = function(out, a, b) {
	        vec4.multiply(out._array, a._array, b._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @method
	     * @param  {qtek.math.Vector4} out
	     * @param  {qtek.math.Vector4} a
	     * @param  {qtek.math.Vector4} b
	     * @return {qtek.math.Vector4}
	     */
	    Vector4.multiply = Vector4.mul;

	    /**
	     * @param  {qtek.math.Vector4} out
	     * @param  {qtek.math.Vector4} a
	     * @return {qtek.math.Vector4}
	     */
	    Vector4.negate = function(out, a) {
	        vec4.negate(out._array, a._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Vector4} out
	     * @param  {qtek.math.Vector4} a
	     * @return {qtek.math.Vector4}
	     */
	    Vector4.normalize = function(out, a) {
	        vec4.normalize(out._array, a._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Vector4} out
	     * @param  {number}  scale
	     * @return {qtek.math.Vector4}
	     */
	    Vector4.random = function(out, scale) {
	        vec4.random(out._array, scale);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Vector4} out
	     * @param  {qtek.math.Vector4} a
	     * @param  {number}  scale
	     * @return {qtek.math.Vector4}
	     */
	    Vector4.scale = function(out, a, scale) {
	        vec4.scale(out._array, a._array, scale);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Vector4} out
	     * @param  {qtek.math.Vector4} a
	     * @param  {qtek.math.Vector4} b
	     * @param  {number}  scale
	     * @return {qtek.math.Vector4}
	     */
	    Vector4.scaleAndAdd = function(out, a, b, scale) {
	        vec4.scaleAndAdd(out._array, a._array, b._array, scale);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Vector4} a
	     * @param  {qtek.math.Vector4} b
	     * @return {number}
	     */
	    Vector4.sqrDist = function(a, b) {
	        return vec4.sqrDist(a._array, b._array);
	    };

	    /**
	     * @method
	     * @param  {qtek.math.Vector4} a
	     * @param  {qtek.math.Vector4} b
	     * @return {number}
	     */
	    Vector4.squaredDistance = Vector4.sqrDist;

	    /**
	     * @param  {qtek.math.Vector4} a
	     * @return {number}
	     */
	    Vector4.sqrLen = function(a) {
	        return vec4.sqrLen(a._array);
	    };
	    /**
	     * @method
	     * @param  {qtek.math.Vector4} a
	     * @return {number}
	     */
	    Vector4.squaredLength = Vector4.sqrLen;

	    /**
	     * @param  {qtek.math.Vector4} out
	     * @param  {qtek.math.Vector4} a
	     * @param  {qtek.math.Vector4} b
	     * @return {qtek.math.Vector4}
	     */
	    Vector4.sub = function(out, a, b) {
	        vec4.subtract(out._array, a._array, b._array);
	        out._dirty = true;
	        return out;
	    };
	    /**
	     * @method
	     * @param  {qtek.math.Vector4} out
	     * @param  {qtek.math.Vector4} a
	     * @param  {qtek.math.Vector4} b
	     * @return {qtek.math.Vector4}
	     */
	    Vector4.subtract = Vector4.sub;

	    /**
	     * @param  {qtek.math.Vector4} out
	     * @param  {qtek.math.Vector4} a
	     * @param  {qtek.math.Matrix4} m
	     * @return {qtek.math.Vector4}
	     */
	    Vector4.transformMat4 = function(out, a, m) {
	        vec4.transformMat4(out._array, a._array, m._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Vector4} out
	     * @param  {qtek.math.Vector4} a
	     * @param  {qtek.math.Quaternion} q
	     * @return {qtek.math.Vector4}
	     */
	    Vector4.transformQuat = function(out, a, q) {
	        vec4.transformQuat(out._array, a._array, q._array);
	        out._dirty = true;
	        return out;
	    };

	    module.exports = Vector4;


/***/ },
/* 59 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';


	    var glMatrix = __webpack_require__(15);
	    var mat2 = glMatrix.mat2;

	    /**
	     * @constructor
	     * @alias qtek.math.Matrix2
	     */
	    var Matrix2 = function() {

	        /**
	         * Storage of Matrix2
	         * @name _array
	         * @type {Float32Array}
	         */
	        this._array = mat2.create();

	        /**
	         * @name _dirty
	         * @type {boolean}
	         */
	        this._dirty = true;
	    };

	    Matrix2.prototype = {

	        constructor: Matrix2,

	        /**
	         * Set components from array
	         * @param  {Float32Array|number[]} arr
	         */
	        setArray: function (arr) {
	            for (var i = 0; i < this._array.length; i++) {
	                this._array[i] = arr[i];
	            }
	            this._dirty = true;
	            return this;
	        },
	        /**
	         * Clone a new Matrix2
	         * @return {qtek.math.Matrix2}
	         */
	        clone: function() {
	            return (new Matrix2()).copy(this);
	        },

	        /**
	         * Copy from b
	         * @param  {qtek.math.Matrix2} b
	         * @return {qtek.math.Matrix2}
	         */
	        copy: function(b) {
	            mat2.copy(this._array, b._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Calculate the adjugate of self, in-place
	         * @return {qtek.math.Matrix2}
	         */
	        adjoint: function() {
	            mat2.adjoint(this._array, this._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Calculate matrix determinant
	         * @return {number}
	         */
	        determinant: function() {
	            return mat2.determinant(this._array);
	        },

	        /**
	         * Set to a identity matrix
	         * @return {qtek.math.Matrix2}
	         */
	        identity: function() {
	            mat2.identity(this._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Invert self
	         * @return {qtek.math.Matrix2}
	         */
	        invert: function() {
	            mat2.invert(this._array, this._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Alias for mutiply
	         * @param  {qtek.math.Matrix2} b
	         * @return {qtek.math.Matrix2}
	         */
	        mul: function(b) {
	            mat2.mul(this._array, this._array, b._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Alias for multiplyLeft
	         * @param  {qtek.math.Matrix2} a
	         * @return {qtek.math.Matrix2}
	         */
	        mulLeft: function(a) {
	            mat2.mul(this._array, a._array, this._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Multiply self and b
	         * @param  {qtek.math.Matrix2} b
	         * @return {qtek.math.Matrix2}
	         */
	        multiply: function(b) {
	            mat2.multiply(this._array, this._array, b._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Multiply a and self, a is on the left
	         * @param  {qtek.math.Matrix2} a
	         * @return {qtek.math.Matrix2}
	         */
	        multiplyLeft: function(a) {
	            mat2.multiply(this._array, a._array, this._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Rotate self by a given radian
	         * @param  {number}   rad
	         * @return {qtek.math.Matrix2}
	         */
	        rotate: function(rad) {
	            mat2.rotate(this._array, this._array, rad);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Scale self by s
	         * @param  {qtek.math.Vector2}  s
	         * @return {qtek.math.Matrix2}
	         */
	        scale: function(v) {
	            mat2.scale(this._array, this._array, v._array);
	            this._dirty = true;
	            return this;
	        },
	        /**
	         * Transpose self, in-place.
	         * @return {qtek.math.Matrix2}
	         */
	        transpose: function() {
	            mat2.transpose(this._array, this._array);
	            this._dirty = true;
	            return this;
	        },

	        toString: function() {
	            return '[' + Array.prototype.join.call(this._array, ',') + ']';
	        },

	        toArray: function () {
	            return Array.prototype.slice.call(this._array);
	        }
	    };

	    /**
	     * @param  {Matrix2} out
	     * @param  {Matrix2} a
	     * @return {Matrix2}
	     */
	    Matrix2.adjoint = function(out, a) {
	        mat2.adjoint(out._array, a._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Matrix2} out
	     * @param  {qtek.math.Matrix2} a
	     * @return {qtek.math.Matrix2}
	     */
	    Matrix2.copy = function(out, a) {
	        mat2.copy(out._array, a._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Matrix2} a
	     * @return {number}
	     */
	    Matrix2.determinant = function(a) {
	        return mat2.determinant(a._array);
	    };

	    /**
	     * @param  {qtek.math.Matrix2} out
	     * @return {qtek.math.Matrix2}
	     */
	    Matrix2.identity = function(out) {
	        mat2.identity(out._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Matrix2} out
	     * @param  {qtek.math.Matrix2} a
	     * @return {qtek.math.Matrix2}
	     */
	    Matrix2.invert = function(out, a) {
	        mat2.invert(out._array, a._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Matrix2} out
	     * @param  {qtek.math.Matrix2} a
	     * @param  {qtek.math.Matrix2} b
	     * @return {qtek.math.Matrix2}
	     */
	    Matrix2.mul = function(out, a, b) {
	        mat2.mul(out._array, a._array, b._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @method
	     * @param  {qtek.math.Matrix2} out
	     * @param  {qtek.math.Matrix2} a
	     * @param  {qtek.math.Matrix2} b
	     * @return {qtek.math.Matrix2}
	     */
	    Matrix2.multiply = Matrix2.mul;

	    /**
	     * @param  {qtek.math.Matrix2} out
	     * @param  {qtek.math.Matrix2} a
	     * @param  {number}   rad
	     * @return {qtek.math.Matrix2}
	     */
	    Matrix2.rotate = function(out, a, rad) {
	        mat2.rotate(out._array, a._array, rad);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Matrix2} out
	     * @param  {qtek.math.Matrix2} a
	     * @param  {qtek.math.Vector2}  v
	     * @return {qtek.math.Matrix2}
	     */
	    Matrix2.scale = function(out, a, v) {
	        mat2.scale(out._array, a._array, v._array);
	        out._dirty = true;
	        return out;
	    };
	    /**
	     * @param  {Matrix2} out
	     * @param  {Matrix2} a
	     * @return {Matrix2}
	     */
	    Matrix2.transpose = function(out, a) {
	        mat2.transpose(out._array, a._array);
	        out._dirty = true;
	        return out;
	    };

	    module.exports = Matrix2;


/***/ },
/* 60 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';


	    var glMatrix = __webpack_require__(15);
	    var mat2d = glMatrix.mat2d;

	    /**
	     * @constructor
	     * @alias qtek.math.Matrix2d
	     */
	    var Matrix2d = function() {
	        /**
	         * Storage of Matrix2d
	         * @name _array
	         * @type {Float32Array}
	         */
	        this._array = mat2d.create();

	        /**
	         * @name _dirty
	         * @type {boolean}
	         */
	        this._dirty = true;
	    };

	    Matrix2d.prototype = {

	        constructor: Matrix2d,

	        /**
	         * Set components from array
	         * @param  {Float32Array|number[]} arr
	         */
	        setArray: function (arr) {
	            for (var i = 0; i < this._array.length; i++) {
	                this._array[i] = arr[i];
	            }
	            this._dirty = true;
	            return this;
	        },
	        /**
	         * Clone a new Matrix2d
	         * @return {qtek.math.Matrix2d}
	         */
	        clone: function() {
	            return (new Matrix2d()).copy(this);
	        },

	        /**
	         * Copy from b
	         * @param  {qtek.math.Matrix2d} b
	         * @return {qtek.math.Matrix2d}
	         */
	        copy: function(b) {
	            mat2d.copy(this._array, b._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Calculate matrix determinant
	         * @return {number}
	         */
	        determinant: function() {
	            return mat2d.determinant(this._array);
	        },

	        /**
	         * Set to a identity matrix
	         * @return {qtek.math.Matrix2d}
	         */
	        identity: function() {
	            mat2d.identity(this._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Invert self
	         * @return {qtek.math.Matrix2d}
	         */
	        invert: function() {
	            mat2d.invert(this._array, this._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Alias for mutiply
	         * @param  {qtek.math.Matrix2d} b
	         * @return {qtek.math.Matrix2d}
	         */
	        mul: function(b) {
	            mat2d.mul(this._array, this._array, b._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Alias for multiplyLeft
	         * @param  {qtek.math.Matrix2d} a
	         * @return {qtek.math.Matrix2d}
	         */
	        mulLeft: function(b) {
	            mat2d.mul(this._array, b._array, this._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Multiply self and b
	         * @param  {qtek.math.Matrix2d} b
	         * @return {qtek.math.Matrix2d}
	         */
	        multiply: function(b) {
	            mat2d.multiply(this._array, this._array, b._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Multiply a and self, a is on the left
	         * @param  {qtek.math.Matrix2d} a
	         * @return {qtek.math.Matrix2d}
	         */
	        multiplyLeft: function(b) {
	            mat2d.multiply(this._array, b._array, this._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Rotate self by a given radian
	         * @param  {number}   rad
	         * @return {qtek.math.Matrix2d}
	         */
	        rotate: function(rad) {
	            mat2d.rotate(this._array, this._array, rad);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Scale self by s
	         * @param  {qtek.math.Vector2}  s
	         * @return {qtek.math.Matrix2d}
	         */
	        scale: function(s) {
	            mat2d.scale(this._array, this._array, s._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Translate self by v
	         * @param  {qtek.math.Vector2}  v
	         * @return {qtek.math.Matrix2d}
	         */
	        translate: function(v) {
	            mat2d.translate(this._array, this._array, v._array);
	            this._dirty = true;
	            return this;
	        },

	        toString: function() {
	            return '[' + Array.prototype.join.call(this._array, ',') + ']';
	        },

	        toArray: function () {
	            return Array.prototype.slice.call(this._array);
	        }
	    };

	    /**
	     * @param  {qtek.math.Matrix2d} out
	     * @param  {qtek.math.Matrix2d} a
	     * @return {qtek.math.Matrix2d}
	     */
	    Matrix2d.copy = function(out, a) {
	        mat2d.copy(out._array, a._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Matrix2d} a
	     * @return {number}
	     */
	    Matrix2d.determinant = function(a) {
	        return mat2d.determinant(a._array);
	    };

	    /**
	     * @param  {qtek.math.Matrix2d} out
	     * @return {qtek.math.Matrix2d}
	     */
	    Matrix2d.identity = function(out) {
	        mat2d.identity(out._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Matrix2d} out
	     * @param  {qtek.math.Matrix2d} a
	     * @return {qtek.math.Matrix2d}
	     */
	    Matrix2d.invert = function(out, a) {
	        mat2d.invert(out._array, a._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Matrix2d} out
	     * @param  {qtek.math.Matrix2d} a
	     * @param  {qtek.math.Matrix2d} b
	     * @return {qtek.math.Matrix2d}
	     */
	    Matrix2d.mul = function(out, a, b) {
	        mat2d.mul(out._array, a._array, b._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @method
	     * @param  {qtek.math.Matrix2d} out
	     * @param  {qtek.math.Matrix2d} a
	     * @param  {qtek.math.Matrix2d} b
	     * @return {qtek.math.Matrix2d}
	     */
	    Matrix2d.multiply = Matrix2d.mul;

	    /**
	     * @param  {qtek.math.Matrix2d} out
	     * @param  {qtek.math.Matrix2d} a
	     * @param  {number}   rad
	     * @return {qtek.math.Matrix2d}
	     */
	    Matrix2d.rotate = function(out, a, rad) {
	        mat2d.rotate(out._array, a._array, rad);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Matrix2d} out
	     * @param  {qtek.math.Matrix2d} a
	     * @param  {qtek.math.Vector2}  v
	     * @return {qtek.math.Matrix2d}
	     */
	    Matrix2d.scale = function(out, a, v) {
	        mat2d.scale(out._array, a._array, v._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Matrix2d} out
	     * @param  {qtek.math.Matrix2d} a
	     * @param  {qtek.math.Vector2}  v
	     * @return {qtek.math.Matrix2d}
	     */
	    Matrix2d.translate = function(out, a, v) {
	        mat2d.translate(out._array, a._array, v._array);
	        out._dirty = true;
	        return out;
	    };

	    module.exports = Matrix2d;


/***/ },
/* 61 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';


	    var glMatrix = __webpack_require__(15);
	    var mat3 = glMatrix.mat3;

	    /**
	     * @constructor
	     * @alias qtek.math.Matrix3
	     */
	    var Matrix3 = function () {

	        /**
	         * Storage of Matrix3
	         * @name _array
	         * @type {Float32Array}
	         */
	        this._array = mat3.create();

	        /**
	         * @name _dirty
	         * @type {boolean}
	         */
	        this._dirty = true;
	    };

	    Matrix3.prototype = {

	        constructor: Matrix3,

	        /**
	         * Set components from array
	         * @param  {Float32Array|number[]} arr
	         */
	        setArray: function (arr) {
	            for (var i = 0; i < this._array.length; i++) {
	                this._array[i] = arr[i];
	            }
	            this._dirty = true;
	            return this;
	        },
	        /**
	         * Calculate the adjugate of self, in-place
	         * @return {qtek.math.Matrix3}
	         */
	        adjoint: function () {
	            mat3.adjoint(this._array, this._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Clone a new Matrix3
	         * @return {qtek.math.Matrix3}
	         */
	        clone: function () {
	            return (new Matrix3()).copy(this);
	        },

	        /**
	         * Copy from b
	         * @param  {qtek.math.Matrix3} b
	         * @return {qtek.math.Matrix3}
	         */
	        copy: function (b) {
	            mat3.copy(this._array, b._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Calculate matrix determinant
	         * @return {number}
	         */
	        determinant: function () {
	            return mat3.determinant(this._array);
	        },

	        /**
	         * Copy the values from Matrix2d a
	         * @param  {qtek.math.Matrix2d} a
	         * @return {qtek.math.Matrix3}
	         */
	        fromMat2d: function (a) {
	            mat3.fromMat2d(this._array, a._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Copies the upper-left 3x3 values of Matrix4
	         * @param  {qtek.math.Matrix4} a
	         * @return {qtek.math.Matrix3}
	         */
	        fromMat4: function (a) {
	            mat3.fromMat4(this._array, a._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Calculates a rotation matrix from the given quaternion
	         * @param  {qtek.math.Quaternion} q
	         * @return {qtek.math.Matrix3}
	         */
	        fromQuat: function (q) {
	            mat3.fromQuat(this._array, q._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Set to a identity matrix
	         * @return {qtek.math.Matrix3}
	         */
	        identity: function () {
	            mat3.identity(this._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Invert self
	         * @return {qtek.math.Matrix3}
	         */
	        invert: function () {
	            mat3.invert(this._array, this._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Alias for mutiply
	         * @param  {qtek.math.Matrix3} b
	         * @return {qtek.math.Matrix3}
	         */
	        mul: function (b) {
	            mat3.mul(this._array, this._array, b._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Alias for multiplyLeft
	         * @param  {qtek.math.Matrix3} a
	         * @return {qtek.math.Matrix3}
	         */
	        mulLeft: function (a) {
	            mat3.mul(this._array, a._array, this._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Multiply self and b
	         * @param  {qtek.math.Matrix3} b
	         * @return {qtek.math.Matrix3}
	         */
	        multiply: function (b) {
	            mat3.multiply(this._array, this._array, b._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Multiply a and self, a is on the left
	         * @param  {qtek.math.Matrix3} a
	         * @return {qtek.math.Matrix3}
	         */
	        multiplyLeft: function (a) {
	            mat3.multiply(this._array, a._array, this._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Rotate self by a given radian
	         * @param  {number}   rad
	         * @return {qtek.math.Matrix3}
	         */
	        rotate: function (rad) {
	            mat3.rotate(this._array, this._array, rad);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Scale self by s
	         * @param  {qtek.math.Vector2}  s
	         * @return {qtek.math.Matrix3}
	         */
	        scale: function (v) {
	            mat3.scale(this._array, this._array, v._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Translate self by v
	         * @param  {qtek.math.Vector2}  v
	         * @return {qtek.math.Matrix3}
	         */
	        translate: function (v) {
	            mat3.translate(this._array, this._array, v._array);
	            this._dirty = true;
	            return this;
	        },
	        /**
	         * Calculates a 3x3 normal matrix (transpose inverse) from the 4x4 matrix
	         * @param {qtek.math.Matrix4} a
	         */
	        normalFromMat4: function (a) {
	            mat3.normalFromMat4(this._array, a._array);
	            this._dirty = true;
	            return this;
	        },

	        /**
	         * Transpose self, in-place.
	         * @return {qtek.math.Matrix2}
	         */
	        transpose: function () {
	            mat3.transpose(this._array, this._array);
	            this._dirty = true;
	            return this;
	        },

	        toString: function () {
	            return '[' + Array.prototype.join.call(this._array, ',') + ']';
	        },

	        toArray: function () {
	            return Array.prototype.slice.call(this._array);
	        }
	    };
	    /**
	     * @param  {qtek.math.Matrix3} out
	     * @param  {qtek.math.Matrix3} a
	     * @return {qtek.math.Matrix3}
	     */
	    Matrix3.adjoint = function (out, a) {
	        mat3.adjoint(out._array, a._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Matrix3} out
	     * @param  {qtek.math.Matrix3} a
	     * @return {qtek.math.Matrix3}
	     */
	    Matrix3.copy = function (out, a) {
	        mat3.copy(out._array, a._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Matrix3} a
	     * @return {number}
	     */
	    Matrix3.determinant = function (a) {
	        return mat3.determinant(a._array);
	    };

	    /**
	     * @param  {qtek.math.Matrix3} out
	     * @return {qtek.math.Matrix3}
	     */
	    Matrix3.identity = function (out) {
	        mat3.identity(out._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Matrix3} out
	     * @param  {qtek.math.Matrix3} a
	     * @return {qtek.math.Matrix3}
	     */
	    Matrix3.invert = function (out, a) {
	        mat3.invert(out._array, a._array);
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Matrix3} out
	     * @param  {qtek.math.Matrix3} a
	     * @param  {qtek.math.Matrix3} b
	     * @return {qtek.math.Matrix3}
	     */
	    Matrix3.mul = function (out, a, b) {
	        mat3.mul(out._array, a._array, b._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @method
	     * @param  {qtek.math.Matrix3} out
	     * @param  {qtek.math.Matrix3} a
	     * @param  {qtek.math.Matrix3} b
	     * @return {qtek.math.Matrix3}
	     */
	    Matrix3.multiply = Matrix3.mul;

	    /**
	     * @param  {qtek.math.Matrix3}  out
	     * @param  {qtek.math.Matrix2d} a
	     * @return {qtek.math.Matrix3}
	     */
	    Matrix3.fromMat2d = function (out, a) {
	        mat3.fromMat2d(out._array, a._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Matrix3} out
	     * @param  {qtek.math.Matrix4} a
	     * @return {qtek.math.Matrix3}
	     */
	    Matrix3.fromMat4 = function (out, a) {
	        mat3.fromMat4(out._array, a._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Matrix3}    out
	     * @param  {qtek.math.Quaternion} a
	     * @return {qtek.math.Matrix3}
	     */
	    Matrix3.fromQuat = function (out, q) {
	        mat3.fromQuat(out._array, q._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Matrix3} out
	     * @param  {qtek.math.Matrix4} a
	     * @return {qtek.math.Matrix3}
	     */
	    Matrix3.normalFromMat4 = function (out, a) {
	        mat3.normalFromMat4(out._array, a._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Matrix3} out
	     * @param  {qtek.math.Matrix3} a
	     * @param  {number}  rad
	     * @return {qtek.math.Matrix3}
	     */
	    Matrix3.rotate = function (out, a, rad) {
	        mat3.rotate(out._array, a._array, rad);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Matrix3} out
	     * @param  {qtek.math.Matrix3} a
	     * @param  {qtek.math.Vector2} v
	     * @return {qtek.math.Matrix3}
	     */
	    Matrix3.scale = function (out, a, v) {
	        mat3.scale(out._array, a._array, v._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Matrix3} out
	     * @param  {qtek.math.Matrix3} a
	     * @return {qtek.math.Matrix3}
	     */
	    Matrix3.transpose = function (out, a) {
	        mat3.transpose(out._array, a._array);
	        out._dirty = true;
	        return out;
	    };

	    /**
	     * @param  {qtek.math.Matrix3} out
	     * @param  {qtek.math.Matrix3} a
	     * @param  {qtek.math.Vector2} v
	     * @return {qtek.math.Matrix3}
	     */
	    Matrix3.translate = function (out, a, v) {
	        mat3.translate(out._array, a._array, v._array);
	        out._dirty = true;
	        return out;
	    };

	    module.exports = Matrix3;


/***/ },
/* 62 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';


	    var Vector3 = __webpack_require__(14);
	    var glMatrix = __webpack_require__(15);
	    var vec3 = glMatrix.vec3;
	    var mat4 = glMatrix.mat4;
	    var vec4 = glMatrix.vec4;

	    /**
	     * @constructor
	     * @alias qtek.math.Plane
	     * @param {qtek.math.Vector3} [normal]
	     * @param {number} [distance]
	     */
	    var Plane = function(normal, distance) {
	        /**
	         * Normal of the plane
	         * @type {qtek.math.Vector3}
	         */
	        this.normal = normal || new Vector3(0, 1, 0);

	        /**
	         * Constant of the plane equation, used as distance to the origin
	         * @type {number}
	         */
	        this.distance = distance || 0;
	    };

	    Plane.prototype = {

	        constructor: Plane,

	        /**
	         * Distance from given point to plane
	         * @param  {qtek.math.Vector3} point
	         * @return {number}
	         */
	        distanceToPoint: function(point) {
	            return vec3.dot(point._array, this.normal._array) - this.distance;
	        },

	        /**
	         * Calculate the projection on the plane of point
	         * @param  {qtek.math.Vector3} point
	         * @param  {qtek.math.Vector3} out
	         * @return {qtek.math.Vector3}
	         */
	        projectPoint: function(point, out) {
	            if (!out) {
	                out = new Vector3();
	            }
	            var d = this.distanceToPoint(point);
	            vec3.scaleAndAdd(out._array, point._array, this.normal._array, -d);
	            out._dirty = true;
	            return out;
	        },

	        /**
	         * Normalize the plane's normal and calculate distance
	         */
	        normalize: function() {
	            var invLen = 1 / vec3.len(this.normal._array);
	            vec3.scale(this.normal._array, invLen);
	            this.distance *= invLen;
	        },

	        /**
	         * If the plane intersect a frustum
	         * @param  {qtek.math.Frustum} Frustum
	         * @return {boolean}
	         */
	        intersectFrustum: function(frustum) {
	            // Check if all coords of frustum is on plane all under plane
	            var coords = frustum.vertices;
	            var normal = this.normal._array;
	            var onPlane = vec3.dot(coords[0]._array, normal) > this.distance;
	            for (var i = 1; i < 8; i++) {
	                if ((vec3.dot(coords[i]._array, normal) > this.distance) != onPlane) {
	                    return true;
	                } 
	            }
	        },

	        /**
	         * Calculate the intersection point between plane and a given line
	         * @method
	         * @param {qtek.math.Vector3} start start point of line
	         * @param {qtek.math.Vector3} end end point of line
	         * @param {qtek.math.Vector3} [out]
	         * @return {qtek.math.Vector3}
	         */
	        intersectLine: (function() {
	            var rd = vec3.create();
	            return function(start, end, out) {
	                var d0 = this.distanceToPoint(start);
	                var d1 = this.distanceToPoint(end);
	                if ((d0 > 0 && d1 > 0) || (d0 < 0 && d1 < 0)) {
	                    return null;
	                }
	                // Ray intersection
	                var pn = this.normal._array;
	                var d = this.distance;
	                var ro = start._array;
	                // direction
	                vec3.sub(rd, end._array, start._array);
	                vec3.normalize(rd, rd);

	                var divider = vec3.dot(pn, rd);
	                // ray is parallel to the plane
	                if (divider === 0) {
	                    return null;
	                }
	                if (!out) {
	                    out = new Vector3();
	                }
	                var t = (vec3.dot(pn, ro) - d) / divider;
	                vec3.scaleAndAdd(out._array, ro, rd, -t);
	                out._dirty = true;
	                return out;
	            };
	        })(),

	        /**
	         * Apply an affine transform matrix to plane
	         * @method
	         * @return {qtek.math.Matrix4}
	         */
	        applyTransform: (function() {
	            var inverseTranspose = mat4.create();
	            var normalv4 = vec4.create();
	            var pointv4 = vec4.create();
	            pointv4[3] = 1;
	            return function(m4) {
	                m4 = m4._array;
	                // Transform point on plane
	                vec3.scale(pointv4, this.normal._array, this.distance);
	                vec4.transformMat4(pointv4, pointv4, m4);
	                this.distance = vec3.dot(pointv4, this.normal._array);
	                // Transform plane normal
	                mat4.invert(inverseTranspose, m4);
	                mat4.transpose(inverseTranspose, inverseTranspose);
	                normalv4[3] = 0;
	                vec3.copy(normalv4, this.normal._array);
	                vec4.transformMat4(normalv4, normalv4, inverseTranspose);
	                vec3.copy(this.normal._array, normalv4);
	            };
	        })(),

	        /**
	         * Copy from another plane
	         * @param  {qtek.math.Vector3} plane
	         */
	        copy: function(plane) {
	            vec3.copy(this.normal._array, plane.normal._array);
	            this.normal._dirty = true;
	            this.distance = plane.distance;
	        },

	        /**
	         * Clone a new plane
	         * @return {qtek.math.Plane}
	         */
	        clone: function() {
	            var plane = new Plane();
	            plane.copy(this);
	            return plane;
	        }
	    };

	    module.exports = Plane;


/***/ },
/* 63 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';


	    var Vector3 = __webpack_require__(14);
	    var BoundingBox = __webpack_require__(13);
	    var Plane = __webpack_require__(62);

	    var glMatrix = __webpack_require__(15);
	    var vec3 = glMatrix.vec3;

	    var vec3Set = vec3.set;
	    var vec3Copy = vec3.copy;
	    var vec3TranformMat4 = vec3.transformMat4;
	    var mathMin = Math.min;
	    var mathMax = Math.max;
	    /**
	     * @constructor
	     * @alias qtek.math.Frustum
	     */
	    var Frustum = function() {

	        /**
	         * Eight planes to enclose the frustum
	         * @type {qtek.math.Plane[]}
	         */
	        this.planes = [];

	        for (var i = 0; i < 6; i++) {
	            this.planes.push(new Plane());
	        }

	        /**
	         * Bounding box of frustum
	         * @type {qtek.math.BoundingBox}
	         */
	        this.boundingBox = new BoundingBox();

	        /**
	         * Eight vertices of frustum
	         * @type {Float32Array[]}
	         */
	        this.vertices = [];
	        for (var i = 0; i < 8; i++) {
	            this.vertices[i] = vec3.fromValues(0, 0, 0);
	        }
	    };

	    Frustum.prototype = {

	        // http://web.archive.org/web/20120531231005/http://crazyjoke.free.fr/doc/3D/plane%20extraction.pdf
	        /**
	         * Set frustum from a projection matrix
	         * @param {qtek.math.Matrix4} projectionMatrix
	         */
	        setFromProjection: function(projectionMatrix) {

	            var planes = this.planes;
	            var m = projectionMatrix._array;
	            var m0 = m[0], m1 = m[1], m2 = m[2], m3 = m[3];
	            var m4 = m[4], m5 = m[5], m6 = m[6], m7 = m[7];
	            var m8 = m[8], m9 = m[9], m10 = m[10], m11 = m[11];
	            var m12 = m[12], m13 = m[13], m14 = m[14], m15 = m[15];

	            // Update planes
	            vec3Set(planes[0].normal._array, m3 - m0, m7 - m4, m11 - m8);
	            planes[0].distance = -(m15 - m12);
	            planes[0].normalize();

	            vec3Set(planes[1].normal._array, m3 + m0, m7 + m4, m11 + m8);
	            planes[1].distance = -(m15 + m12);
	            planes[1].normalize();

	            vec3Set(planes[2].normal._array, m3 + m1, m7 + m5, m11 + m9);
	            planes[2].distance = -(m15 + m13);
	            planes[2].normalize();

	            vec3Set(planes[3].normal._array, m3 - m1, m7 - m5, m11 - m9);
	            planes[3].distance = -(m15 - m13);
	            planes[3].normalize();

	            vec3Set(planes[4].normal._array, m3 - m2, m7 - m6, m11 - m10);
	            planes[4].distance = -(m15 - m14);
	            planes[4].normalize();

	            vec3Set(planes[5].normal._array, m3 + m2, m7 + m6, m11 + m10);
	            planes[5].distance = -(m15 + m14);
	            planes[5].normalize();

	            // Perspective projection
	            var boundingBox = this.boundingBox;
	            if (m15 === 0)  {
	                var aspect = m5 / m0;
	                var zNear = -m14 / (m10 - 1);
	                var zFar = -m14 / (m10 + 1);
	                var farY = -zFar / m5;
	                var nearY = -zNear / m5;
	                // Update bounding box
	                boundingBox.min.set(-farY * aspect, -farY, zFar);
	                boundingBox.max.set(farY * aspect, farY, zNear);
	                // update vertices
	                var vertices = this.vertices;
	                //--- min z
	                // min x
	                vec3Set(vertices[0], -farY * aspect, -farY, zFar);
	                vec3Set(vertices[1], -farY * aspect, farY, zFar);
	                // max x
	                vec3Set(vertices[2], farY * aspect, -farY, zFar);
	                vec3Set(vertices[3], farY * aspect, farY, zFar);
	                //-- max z
	                vec3Set(vertices[4], -nearY * aspect, -nearY, zNear);
	                vec3Set(vertices[5], -nearY * aspect, nearY, zNear);
	                vec3Set(vertices[6], nearY * aspect, -nearY, zNear);
	                vec3Set(vertices[7], nearY * aspect, nearY, zNear);
	            }
	            else { // Orthographic projection
	                var left = (-1 - m12) / m0;
	                var right = (1 - m12) / m0;
	                var top = (1 - m13) / m5;
	                var bottom = (-1 - m13) / m5;
	                var near = (-1 - m14) / m10;
	                var far = (1 - m14) / m10;

	                boundingBox.min.set(left, bottom, far);
	                boundingBox.max.set(right, top, near);

	                var min = boundingBox.min._array;
	                var max = boundingBox.max._array;
	                var vertices = this.vertices;
	                //--- min z
	                // min x
	                vec3Set(vertices[0], min[0], min[1], min[2]);
	                vec3Set(vertices[1], min[0], max[1], min[2]);
	                // max x
	                vec3Set(vertices[2], max[0], min[1], min[2]);
	                vec3Set(vertices[3], max[0], max[1], min[2]);
	                //-- max z
	                vec3Set(vertices[4], min[0], min[1], max[2]);
	                vec3Set(vertices[5], min[0], max[1], max[2]);
	                vec3Set(vertices[6], max[0], min[1], max[2]);
	                vec3Set(vertices[7], max[0], max[1], max[2]);
	            }
	        },

	        /**
	         * Apply a affine transform matrix and set to the given bounding box
	         * @method
	         * @param {qtek.math.BoundingBox}
	         * @param {qtek.math.Matrix4}
	         * @return {qtek.math.BoundingBox}
	         */
	        getTransformedBoundingBox: (function() {

	            var tmpVec3 = vec3.create();

	            return function(bbox, matrix) {
	                var vertices = this.vertices;

	                var m4 = matrix._array;
	                var min = bbox.min;
	                var max = bbox.max;
	                var minArr = min._array;
	                var maxArr = max._array;
	                var v = vertices[0];
	                vec3TranformMat4(tmpVec3, v, m4);
	                vec3Copy(minArr, tmpVec3);
	                vec3Copy(maxArr, tmpVec3);

	                for (var i = 1; i < 8; i++) {
	                    v = vertices[i];
	                    vec3TranformMat4(tmpVec3, v, m4);

	                    minArr[0] = mathMin(tmpVec3[0], minArr[0]);
	                    minArr[1] = mathMin(tmpVec3[1], minArr[1]);
	                    minArr[2] = mathMin(tmpVec3[2], minArr[2]);

	                    maxArr[0] = mathMax(tmpVec3[0], maxArr[0]);
	                    maxArr[1] = mathMax(tmpVec3[1], maxArr[1]);
	                    maxArr[2] = mathMax(tmpVec3[2], maxArr[2]);
	                }

	                min._dirty = true;
	                max._dirty = true;

	                return bbox;
	            };
	        }) ()
	    };
	    module.exports = Frustum;


/***/ },
/* 64 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * Provide orbit control for 3D objects
	 *
	 * @module echarts-gl/util/OrbitControl
	 * @author Yi Shen(http://github.com/pissang)
	 */

	var Base = __webpack_require__(6);
	var Vector2 = __webpack_require__(22);
	var Vector3 = __webpack_require__(14);
	var Quaternion = __webpack_require__(29);

	/**
	 * @alias module:echarts-x/util/OrbitControl
	 */
	var OrbitControl = Base.extend(function () {

	    return {
	        /**
	         * @type {module:zrender~ZRender}
	         */
	        zr: null,

	        /**
	         * @type {qtek.math.Vector3}
	         */
	        origin: new Vector3(),

	        /**
	         * Minimum distance to the origin
	         * @type {number}
	         * @default 0.5
	         */
	        minDistance: 0.5,

	        /**
	         * Maximum distance to the origin
	         * @type {number}
	         * @default 2
	         */
	        maxDistance: 1.5,

	        /**
	         * Start auto rotating after still for the given time
	         */
	        autoRotateAfterStill: 0,

	        /**
	         * Pan or rotate
	         * @type {String}
	         */
	        mode: 'rotate',

	        /**
	         * @type {qtek.Camera}
	         */
	        _camera: null,

	        _needsUpdate: false,

	        _rotating: false,

	        _rotateY: 0,
	        _rotateX: 0,

	        _mouseX: 0,
	        _mouseY: 0,

	        _rotateVelocity: new Vector2(),

	        _panVelocity: new Vector2(),

	        _distance: 100,

	        _zoomSpeed: 0,

	        _animating: false,

	        _stillTimeout: 0,

	        _animators: []
	    };
	}, {
	    /**
	     * Initialize.
	     * Mouse event binding
	     */
	    init: function () {
	        this._animating = false;
	        this.zr.on('mousedown', this._mouseDownHandler, this);
	        this.zr.on('mousewheel', this._mouseWheelHandler, this);

	        this._decomposeRotation();

	        this.zr.animation.on('frame', this._update, this);
	    },

	    /**
	     * Dispose.
	     * Mouse event unbinding
	     */
	    dispose: function () {
	        this.zr.off('mousedown', this._mouseDownHandler);
	        this.zr.off('mousemove', this._mouseMoveHandler);
	        this.zr.off('mouseup', this._mouseUpHandler);
	        this.zr.off('mousewheel', this._mouseWheelHandler);

	        this.stopAllAnimation();
	    },

	    /**
	     * Get distance
	     * @return {number}
	     */
	    getDistance: function () {
	        return this._distance;
	    },

	    /**
	     * Set distance
	     * @param {number} distance
	     */
	    setDistance: function (distance) {
	        this._distance = distance;
	        this._needsUpdate = false;
	    },

	    setCamera: function (target) {
	        this._camera = target;
	        this._decomposeRotation();
	    },

	    /**
	     * Rotation to animation, Params can be target quaternion or x, y, z axis
	     * @example
	     *     control.rotateTo({
	     *         x: transform.x,
	     *         y: transform.y,
	     *         z: transform.z,
	     *         time: 1000
	     *     });
	     *     control.rotateTo({
	     *         rotation: quat,
	     *         time: 1000,
	     *         easing: 'CubicOut'
	     *     })
	     *     .done(function() {
	     *         xxx
	     *     });
	     * @param {Object} opts
	     * @param {qtek.math.Quaternion} [opts.rotation]
	     * @param {qtek.math.Vector3} [opts.x]
	     * @param {qtek.math.Vector3} [opts.y]
	     * @param {qtek.math.Vector3} [opts.z]
	     * @param {number} [opts.time=1000]
	     * @param {number} [opts.easing='Linear']
	     */
	    rotateTo: function (opts) {
	        var toQuat;
	        var self = this;
	        if (!opts.rotation) {
	            toQuat = new Quaternion();
	            var view = new Vector3();
	            Vector3.negate(view, opts.z);
	            toQuat.setAxes(view, opts.x, opts.y);
	        }
	        else {
	            toQuat = opts.rotation;
	        }

	        // TODO
	        // var zr = this.zr;
	        // var obj = {
	        //     p: 0
	        // };

	        // var target = this._camera;
	        // var fromQuat = target.rotation.clone();
	        // this._animating = true;
	        // return this._addAnimator(
	        //     zr.animation.animate(obj)
	        //         .when(opts.time || 1000, {
	        //             p: 1
	        //         })
	        //         .during(function () {
	        //             Quaternion.slerp(
	        //                 target.rotation, fromQuat, toQuat, obj.p
	        //             );
	        //             zr.refresh();
	        //         })
	        //         .done(function () {
	        //             self._animating = false;
	        //             self._decomposeRotation();
	        //         })
	        //         .start(opts.easing || 'Linear')
	        // );
	    },

	    /**
	     * Zoom to animation
	     * @param {Object} opts
	     * @param {number} opts.distance
	     * @param {number} [opts.time=1000]
	     * @param {number} [opts.easing='Linear']
	     */
	    zoomTo: function (opts) {
	        var zr = this.zr;
	        var distance = opts.distance;
	        var self = this;

	        distance = Math.max(Math.min(this.maxDistance, distance), this.minDistance);
	        this._animating = true;
	        return this._addAnimator(
	            zr.animation.animate(this)
	                .when(opts.time || 1000, {
	                    _distance: distance
	                })
	                .during(function () {
	                    self._setDistance(self._distance);
	                    zr.refresh();
	                })
	                .done(function () {
	                    self._animating = false;
	                })
	                .start(opts.easing || 'Linear')
	        );
	    },

	    /**
	     * Stop all animation
	     */
	    stopAllAnimation: function () {
	        for (var i = 0; i < this._animators.length; i++) {
	            this._animators[i].stop();
	        }
	        this._animators.length = 0;
	        this._animating = false;
	    },

	    /**
	     * Call update each frame
	     * @param  {number} deltaTime Frame time
	     */
	    _update: function (deltaTime) {
	        if (this._animating) {
	            return;
	        }

	        this._camera.rotation.identity();
	        this._camera.update();

	        this._updateDistance(deltaTime);

	        if (this.mode === 'rotate') {
	            this._updateRotate(deltaTime);
	        }
	        else if (this.mode === 'pan') {
	            this._updatePan(deltaTime);
	        }

	        if (this._needsUpdate) {
	            this.zr.refresh();
	            this.trigger('update');
	            this._needsUpdate = false;
	        }
	    },

	    _updateRotate: function (deltaTime) {

	        var velocity = this._rotateVelocity;
	        this._rotateY = (velocity.y + this._rotateY) % (Math.PI * 2);
	        this._rotateX = (velocity.x + this._rotateX) % (Math.PI * 2);

	        this._rotateX = Math.max(Math.min(this._rotateX, Math.PI / 2), -Math.PI / 2);


	        this._camera.rotateAround(this.origin, Vector3.UP, -this._rotateY);
	        var xAxis = this._camera.localTransform.x;
	        this._camera.rotateAround(this.origin, xAxis, -this._rotateX);

	        // Rotate speed damping
	        this._vectorDamping(velocity, 0.8);

	        if (this._rotating) {
	            this._rotateY -= deltaTime * 1e-4;
	            this._needsUpdate = true;
	        }
	        else if (velocity.len() > 0) {
	            this._needsUpdate = true;
	        }
	    },

	    _updateDistance: function (deltaTime) {

	        this._setDistance(this._distance + this._zoomSpeed);

	        // Zoom speed damping
	        this._zoomSpeed *= 0.8;
	        if (Math.abs(this._zoomSpeed) > 1e-3) {
	            this._needsUpdate = true;
	        }
	    },

	    _setDistance: function (distance) {
	        this._distance = Math.max(Math.min(distance, this.maxDistance), this.minDistance);
	        var distance = this._distance;

	        var camera = this._camera;

	        var position = this.origin;
	        camera.position.copy(position).scaleAndAdd(
	            camera.worldTransform.z, distance
	        );
	    },

	    _updatePan: function (deltaTime) {
	        var velocity = this._panVelocity;

	        // TODO
	        // var target = this._camera;
	        // var yAxis = target.worldTransform.y;
	        // var xAxis = target.worldTransform.x;

	        // // FIXME Assume origin is ZERO
	        // var len = this.camera.position.len();
	        // // PENDING
	        // target.position
	        //     .scaleAndAdd(xAxis, velocity.x * len / 400)
	        //     .scaleAndAdd(yAxis, velocity.y * len / 400);

	        // Pan damping
	        this._vectorDamping(velocity, 0.8);

	        if (velocity.len() > 0) {
	            this._needsUpdate = true;
	        }
	    },

	    _startCountingStill: function () {
	        clearTimeout(this._stillTimeout);

	        var time = this.autoRotateAfterStill;
	        var self = this;
	        if (!isNaN(time) && time > 0) {
	            this._stillTimeout = setTimeout(function () {
	                self._rotating = true;
	            }, time * 1000);
	        }
	    },

	    _vectorDamping: function (v, damping) {
	        var speed = v.len();
	        speed = speed * damping;
	        if (speed < 1e-4) {
	            speed = 0;
	        }
	        v.normalize().scale(speed);
	    },

	    _decomposeRotation: function () {
	        if (!this._camera) {
	            return;
	        }

	        // TODO
	        // var euler = new Vector3();
	        // // Z Rotate at last so it can be zero
	        // euler.eulerFromQuat(
	        //     this._camera.rotation.normalize(), 'ZXY'
	        // );

	        // this._rotateX = euler.x;
	        // this._rotateY = euler.y;
	    },

	    _mouseDownHandler: function (e) {
	        if (e.target) {
	            // If mouseon some zrender element.
	            return;
	        }
	        if (this._animating) {
	            return;
	        }
	        this.zr.on('mousemove', this._mouseMoveHandler, this);
	        this.zr.on('mouseup', this._mouseUpHandler, this);

	        e = e.event;

	        if (this.mode === 'rotate') {
	            // Reset rotate velocity
	            this._rotateVelocity.set(0, 0);

	            this._rotating = false;

	            if (this.autoRotate) {
	                this._startCountingStill();
	            }
	        }

	        this._mouseX = e.pageX;
	        this._mouseY = e.pageY;
	    },

	    _mouseMoveHandler: function (e) {
	        if (this._animating) {
	            return;
	        }
	        e = e.event;

	        if (this.mode === 'rotate') {
	            this._rotateVelocity.y = (e.pageX - this._mouseX) / 500;
	            this._rotateVelocity.x = (e.pageY - this._mouseY) / 500;
	        }
	        else if (this.mode === 'pan') {
	            this._panVelocity.x = e.pageX - this._mouseX;
	            this._panVelocity.y = -e.pageY + this._mouseY;
	        }

	        this._mouseX = e.pageX;
	        this._mouseY = e.pageY;
	    },

	    _mouseWheelHandler: function (e) {
	        if (this._animating) {
	            return;
	        }
	        e = e.event;
	        var delta = e.wheelDelta // Webkit
	                || -e.detail; // Firefox
	        if (delta === 0) {
	            return;
	        }

	        var distance = Math.min(
	            this._distance - this.minDistance,
	            this.maxDistance - this._distance
	        );
	        this._zoomSpeed = delta > 0 ? distance / 40 : -distance / 40;

	        this._rotating = false;

	        if (this.autoRotate && this.mode === 'rotate') {
	            this._startCountingStill();
	        }
	    },

	    _mouseUpHandler: function () {
	        this.zr.off('mousemove', this._mouseMoveHandler, this);
	        this.zr.off('mouseup', this._mouseUpHandler, this);
	    },

	    _addAnimator: function (animator) {
	        var animators = this._animators;
	        animators.push(animator);
	        animator.done(function () {
	            var idx = animators.indexOf(animator);
	            if (idx >= 0) {
	                animators.splice(idx, 1);
	            }
	        });
	        return animator;
	    }
	});

	/**
	 * If auto rotate the target
	 * @type {boolean}
	 * @default false
	 */
	Object.defineProperty(OrbitControl.prototype, 'autoRotate', {
	    get: function (val) {
	        return this._autoRotate;
	    },
	    set: function (val) {
	        this._autoRotate = val;
	        this._rotating = val;
	    }
	});


	module.exports = OrbitControl;

/***/ },
/* 65 */
/***/ function(module, exports) {

	/*
	 (c) 2011-2014, Vladimir Agafonkin
	 SunCalc is a JavaScript library for calculating sun/mooon position and light phases.
	 https://github.com/mourner/suncalc
	*/

	// shortcuts for easier to read formulas

	var PI   = Math.PI,
	    sin  = Math.sin,
	    cos  = Math.cos,
	    tan  = Math.tan,
	    asin = Math.asin,
	    atan = Math.atan2,
	    rad  = PI / 180;

	// sun calculations are based on http://aa.quae.nl/en/reken/zonpositie.html formulas


	// date/time constants and conversions

	var dayMs = 1000 * 60 * 60 * 24,
	    J1970 = 2440588,
	    J2000 = 2451545;

	function toJulian (date) { return date.valueOf() / dayMs - 0.5 + J1970; }
	function toDays (date)   { return toJulian(date) - J2000; }


	// general calculations for position

	var e = rad * 23.4397; // obliquity of the Earth

	function rightAscension(l, b) { return atan(sin(l) * cos(e) - tan(b) * sin(e), cos(l)); }
	function declination(l, b)    { return asin(sin(b) * cos(e) + cos(b) * sin(e) * sin(l)); }

	function azimuth(H, phi, dec)  { return atan(sin(H), cos(H) * sin(phi) - tan(dec) * cos(phi)); }
	function altitude(H, phi, dec) { return asin(sin(phi) * sin(dec) + cos(phi) * cos(dec) * cos(H)); }

	function siderealTime(d, lw) { return rad * (280.16 + 360.9856235 * d) - lw; }


	// general sun calculations

	function solarMeanAnomaly(d) { return rad * (357.5291 + 0.98560028 * d); }

	function eclipticLongitude(M) {

	    var C = rad * (1.9148 * sin(M) + 0.02 * sin(2 * M) + 0.0003 * sin(3 * M)), // equation of center
	        P = rad * 102.9372; // perihelion of the Earth

	    return M + C + P + PI;
	}

	function sunCoords(d) {

	    var M = solarMeanAnomaly(d),
	        L = eclipticLongitude(M);

	    return {
	        dec: declination(L, 0),
	        ra: rightAscension(L, 0)
	    };
	}

	var SunCalc = {};

	// calculates sun position for a given date and latitude/longitude

	SunCalc.getPosition = function (date, lat, lng) {

	    var lw  = rad * -lng,
	        phi = rad * lat,
	        d   = toDays(date),

	        c  = sunCoords(d),
	        H  = siderealTime(d, lw) - c.ra;

	    return {
	        azimuth: azimuth(H, phi, c.dec),
	        altitude: altitude(H, phi, c.dec)
	    };
	};

	module.exports = SunCalc;

/***/ },
/* 66 */
/***/ function(module, exports) {

	module.exports = "@export ecgl.albedo.vertex\n\nuniform mat4 worldViewProjection : WORLDVIEWPROJECTION;\nuniform vec2 uvRepeat: [1, 1];\n\nattribute vec2 texcoord : TEXCOORD_0;\nattribute vec3 position: POSITION;\n\n#ifdef VERTEX_COLOR\nattribute vec4 a_Color : COLOR;\nvarying vec4 v_Color;\n#endif\n\nvarying vec2 v_Texcoord;\n\nvoid main()\n{\n    gl_Position = worldViewProjection * vec4(position, 1.0);\n    v_Texcoord = texcoord * uvRepeat;\n\n#ifdef VERTEX_COLOR\n    v_Color = a_Color;\n#endif\n}\n\n@end\n\n@export ecgl.albedo.fragment\n\nuniform sampler2D diffuseMap;\nuniform vec3 color : [1.0, 1.0, 1.0];\nuniform float alpha : 1.0;\n\n#ifdef VERTEX_COLOR\nvarying vec4 v_Color;\n#endif\n\nvarying vec2 v_Texcoord;\n\nvoid main()\n{\n    gl_FragColor = vec4(color, alpha);\n\n#ifdef VERTEX_COLOR\n    gl_FragColor *= v_Color;\n#endif\n#ifdef DIFFUSEMAP_ENABLED\n    vec4 tex = texture2D(diffuseMap, v_Texcoord);\n    gl_FragColor *= tex;\n#endif\n}\n@end"

/***/ },
/* 67 */
/***/ function(module, exports) {

	module.exports = "/**\n * http://en.wikipedia.org/wiki/Lambertian_reflectance\n */\n\n@export ecgl.lambert.vertex\n\nuniform mat4 worldViewProjection : WORLDVIEWPROJECTION;\nuniform mat4 worldInverseTranspose : WORLDINVERSETRANSPOSE;\nuniform mat4 world : WORLD;\n\nuniform vec2 uvRepeat : [1.0, 1.0];\nuniform vec2 uvOffset : [0.0, 0.0];\n\nattribute vec3 position : POSITION;\nattribute vec2 texcoord : TEXCOORD_0;\nattribute vec3 normal : NORMAL;\n\n#ifdef VERTEX_COLOR\nattribute vec4 a_Color : COLOR;\nvarying vec4 v_Color;\n#endif\n\nvarying vec2 v_Texcoord;\n\nvarying vec3 v_Normal;\nvarying vec3 v_WorldPosition;\n\nvoid main()\n{\n    v_Texcoord = texcoord * uvRepeat + uvOffset;\n\n    gl_Position = worldViewProjection * vec4(position, 1.0);\n\n    v_Normal = normalize((worldInverseTranspose * vec4(normal, 0.0)).xyz);\n    v_WorldPosition = (world * vec4(position, 1.0)).xyz;\n\n#ifdef VERTEX_COLOR\n    v_Color = a_Color;\n#endif\n}\n\n@end\n\n\n@export ecgl.lambert.fragment\n\n#define PI 3.14159265358979\n\n#extension GL_OES_standard_derivatives : enable\n\nvarying vec2 v_Texcoord;\n\nvarying vec3 v_Normal;\nvarying vec3 v_WorldPosition;\n\n#ifdef DIFFUSEMAP_ENABLED\nuniform sampler2D diffuseMap;\n#endif\n\n#ifdef BUMPMAP_ENABLED\nuniform sampler2D bumpMap;\nuniform float bumpScale : 1.0;\n// Derivative maps - bump mapping unparametrized surfaces by Morten Mikkelsen\n//  http://mmikkelsen3d.blogspot.sk/2011/07/derivative-maps.html\n\n// Evaluate the derivative of the height w.r.t. screen-space using forward differencing (listing 2)\n\nvec3 perturbNormalArb(vec3 surfPos, vec3 surfNormal, vec3 baseNormal)\n{\n    vec2 dSTdx = dFdx(v_Texcoord);\n    vec2 dSTdy = dFdy(v_Texcoord);\n\n    float Hll = bumpScale * texture2D(bumpMap, v_Texcoord).x;\n    float dHx = bumpScale * texture2D(bumpMap, v_Texcoord + dSTdx).x - Hll;\n    float dHy = bumpScale * texture2D(bumpMap, v_Texcoord + dSTdy).x - Hll;\n\n    vec3 vSigmaX = dFdx(surfPos);\n    vec3 vSigmaY = dFdy(surfPos);\n    vec3 vN = surfNormal;\n\n    vec3 R1 = cross(vSigmaY, vN);\n    vec3 R2 = cross(vN, vSigmaX);\n\n    float fDet = dot(vSigmaX, R1);\n\n    vec3 vGrad = sign(fDet) * (dHx * R1 + dHy * R2);\n    return normalize(abs(fDet) * baseNormal - vGrad);\n\n}\n#endif\n\nuniform vec3 color : [1.0, 1.0, 1.0];\nuniform float alpha : 1.0;\n\n#ifdef AMBIENT_LIGHT_COUNT\n@import qtek.header.ambient_light\n#endif\n#ifdef DIRECTIONAL_LIGHT_COUNT\n@import qtek.header.directional_light\n#endif\n\n#ifdef VERTEX_COLOR\nvarying vec4 v_Color;\n#endif\n\nvoid main()\n{\n    gl_FragColor = vec4(color, alpha);\n\n#ifdef VERTEX_COLOR\n    gl_FragColor *= v_Color;\n#endif\n\n#ifdef DIFFUSEMAP_ENABLED\n    vec4 tex = texture2D(diffuseMap, v_Texcoord);\n    gl_FragColor *= tex;\n#endif\n\n    vec3 N = v_Normal;\n    vec3 P = v_WorldPosition;\n    float ambientFactor = 1.0;\n\n#ifdef BUMPMAP_ENABLED\n    N = perturbNormalArb(v_WorldPosition, v_Normal, N);\n    #ifdef FLAT\n        ambientFactor = dot(P, N);\n    #else\n        ambientFactor = dot(v_Normal, N);\n    #endif\n#endif\n\nvec3 diffuseColor = vec3(0.0, 0.0, 0.0);\n\n#ifdef AMBIENT_LIGHT_COUNT\n    for(int i = 0; i < AMBIENT_LIGHT_COUNT; i++)\n    {\n        // Multiply a dot factor to make sure the bump detail can be seen\n        // in the dark side\n        diffuseColor += ambientLightColor[i] * ambientFactor;\n    }\n#endif\n#ifdef DIRECTIONAL_LIGHT_COUNT\n    for(int i = 0; i < DIRECTIONAL_LIGHT_COUNT; i++)\n    {\n        vec3 lightDirection = -directionalLightDirection[i];\n        vec3 lightColor = directionalLightColor[i];\n\n        float ndl = dot(N, normalize(lightDirection));\n\n        float shadowContrib = 1.0;\n        #if defined(DIRECTIONAL_LIGHT_SHADOWMAP_COUNT)\n            if(shadowEnabled)\n            {\n                shadowContrib = shadowContribs[i];\n            }\n        #endif\n\n        diffuseColor += lightColor * clamp(ndl, 0.0, 1.0) * shadowContrib;\n    }\n#endif\n\n    gl_FragColor.rgb *= diffuseColor;\n}\n\n@end"

/***/ },
/* 68 */
/***/ function(module, exports, __webpack_require__) {

	var Globe = __webpack_require__(69);
	var echarts = __webpack_require__(2);
	var layoutUtil = __webpack_require__(70);
	var ViewGL = __webpack_require__(77);

	function resizeGlobe(globeModel, api) {
	    // Use left/top/width/height
	    var boxLayoutOption = globeModel.getBoxLayoutParams();

	    var viewport = layoutUtil.getLayoutRect(boxLayoutOption, {
	        width: api.getWidth(),
	        height: api.getHeight()
	    });

	    this.viewGL.setViewport(viewport.x, viewport.y, viewport.width, viewport.height);

	    this.radius = globeModel.get('globeRadius');
	}

	var globeCreator = {

	    dimensions: Globe.prototype.dimensions,

	    create: function (ecModel, api) {

	        var globeList = [];

	        ecModel.eachComponent('globe', function (globeModel) {

	            // FIXME
	            globeModel.__viewGL = globeModel.__viewGL || new ViewGL();

	            var globe = new Globe();
	            globe.viewGL = globeModel.__viewGL;

	            globeModel.coordinateSystem = globe;
	            globeList.push(globe);

	            // Inject resize
	            globe.resize = resizeGlobe;
	            globe.resize(globeModel, api);
	        });

	        ecModel.eachSeries(function (seriesModel) {
	            if (seriesModel.get('coordinateSystem') === 'globe') {
	                var globeIndex = seriesModel.get('globeIndex');
	                var coordSys = globeList[globeIndex];

	                if (!coordSys) {
	                    console.warn('globe %s not exists', globeIndex);
	                }

	                seriesModel.coordinateSystem = coordSys;
	            }
	        });
	    }
	};

	echarts.registerCoordinateSystem('globe', globeCreator);

	module.exports = globeCreator;

/***/ },
/* 69 */
/***/ function(module, exports, __webpack_require__) {

	var echarts = __webpack_require__(2);
	var Matrix4 = __webpack_require__(16);
	var glmatrix = __webpack_require__(15);
	var vec3 = glmatrix.vec3;


	function Globe(radius) {

	    this.radius = radius || 100;

	    this.viewGL = null;
	}

	Globe.prototype = {

	    constructor: Globe,

	    dimensions: ['lng', 'lat', 'alt'],

	    type: 'globe',

	    dataToPoint: function (data, out) {
	        var lng = data[0];
	        var lat = data[1];
	        // Default have 0 altitude
	        var alt = data[2] || 0;

	        lng = lng * Math.PI / 180;
	        lat = lat * Math.PI / 180;
	        var r = alt + this.radius;
	        var r0 = Math.cos(lat) * r;

	        out = out || [];
	        // PENDING
	        out[0] = -r0 * Math.cos(lng + Math.PI);
	        out[1] = Math.sin(lat) * r;
	        out[2] = r0 * Math.sin(lng + Math.PI);

	        return out;
	    },

	    pointToData: function (point, out) {
	        var x = point[0];
	        var y = point[1];
	        var z = point[2];
	        var len = vec3.len(point);
	        x /= len;
	        y /= len;
	        z /= len;

	        var theta = Math.asin(y);
	        var phi = Math.atan2(z, -x);
	        if (phi < 0) {
	            phi = Math.PI * 2  + phi;
	        }

	        var lat = theta * 180 / Math.PI;
	        var lng = phi * 180 / Math.PI - 180;

	        out = out || [];
	        out[0] = lng;
	        out[1] = lat;
	        out[2] = len - this.radius;

	        return out;
	    }
	};

	module.exports = Globe;

/***/ },
/* 70 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	// Layout helpers for each component positioning


	    var zrUtil = __webpack_require__(34);
	    var BoundingRect = __webpack_require__(71);
	    var numberUtil = __webpack_require__(74);
	    var formatUtil = __webpack_require__(75);
	    var parsePercent = numberUtil.parsePercent;
	    var each = zrUtil.each;

	    var layout = {};

	    var LOCATION_PARAMS = layout.LOCATION_PARAMS = [
	        'left', 'right', 'top', 'bottom', 'width', 'height'
	    ];

	    function boxLayout(orient, group, gap, maxWidth, maxHeight) {
	        var x = 0;
	        var y = 0;
	        if (maxWidth == null) {
	            maxWidth = Infinity;
	        }
	        if (maxHeight == null) {
	            maxHeight = Infinity;
	        }
	        var currentLineMaxSize = 0;
	        group.eachChild(function (child, idx) {
	            var position = child.position;
	            var rect = child.getBoundingRect();
	            var nextChild = group.childAt(idx + 1);
	            var nextChildRect = nextChild && nextChild.getBoundingRect();
	            var nextX;
	            var nextY;
	            if (orient === 'horizontal') {
	                var moveX = rect.width + (nextChildRect ? (-nextChildRect.x + rect.x) : 0);
	                nextX = x + moveX;
	                // Wrap when width exceeds maxWidth or meet a `newline` group
	                if (nextX > maxWidth || child.newline) {
	                    x = 0;
	                    nextX = moveX;
	                    y += currentLineMaxSize + gap;
	                    currentLineMaxSize = rect.height;
	                }
	                else {
	                    currentLineMaxSize = Math.max(currentLineMaxSize, rect.height);
	                }
	            }
	            else {
	                var moveY = rect.height + (nextChildRect ? (-nextChildRect.y + rect.y) : 0);
	                nextY = y + moveY;
	                // Wrap when width exceeds maxHeight or meet a `newline` group
	                if (nextY > maxHeight || child.newline) {
	                    x += currentLineMaxSize + gap;
	                    y = 0;
	                    nextY = moveY;
	                    currentLineMaxSize = rect.width;
	                }
	                else {
	                    currentLineMaxSize = Math.max(currentLineMaxSize, rect.width);
	                }
	            }

	            if (child.newline) {
	                return;
	            }

	            position[0] = x;
	            position[1] = y;

	            orient === 'horizontal'
	                ? (x = nextX + gap)
	                : (y = nextY + gap);
	        });
	    }

	    /**
	     * VBox or HBox layouting
	     * @param {string} orient
	     * @param {module:zrender/container/Group} group
	     * @param {number} gap
	     * @param {number} [width=Infinity]
	     * @param {number} [height=Infinity]
	     */
	    layout.box = boxLayout;

	    /**
	     * VBox layouting
	     * @param {module:zrender/container/Group} group
	     * @param {number} gap
	     * @param {number} [width=Infinity]
	     * @param {number} [height=Infinity]
	     */
	    layout.vbox = zrUtil.curry(boxLayout, 'vertical');

	    /**
	     * HBox layouting
	     * @param {module:zrender/container/Group} group
	     * @param {number} gap
	     * @param {number} [width=Infinity]
	     * @param {number} [height=Infinity]
	     */
	    layout.hbox = zrUtil.curry(boxLayout, 'horizontal');

	    /**
	     * If x or x2 is not specified or 'center' 'left' 'right',
	     * the width would be as long as possible.
	     * If y or y2 is not specified or 'middle' 'top' 'bottom',
	     * the height would be as long as possible.
	     *
	     * @param {Object} positionInfo
	     * @param {number|string} [positionInfo.x]
	     * @param {number|string} [positionInfo.y]
	     * @param {number|string} [positionInfo.x2]
	     * @param {number|string} [positionInfo.y2]
	     * @param {Object} containerRect
	     * @param {string|number} margin
	     * @return {Object} {width, height}
	     */
	    layout.getAvailableSize = function (positionInfo, containerRect, margin) {
	        var containerWidth = containerRect.width;
	        var containerHeight = containerRect.height;

	        var x = parsePercent(positionInfo.x, containerWidth);
	        var y = parsePercent(positionInfo.y, containerHeight);
	        var x2 = parsePercent(positionInfo.x2, containerWidth);
	        var y2 = parsePercent(positionInfo.y2, containerHeight);

	        (isNaN(x) || isNaN(parseFloat(positionInfo.x))) && (x = 0);
	        (isNaN(x2) || isNaN(parseFloat(positionInfo.x2))) && (x2 = containerWidth);
	        (isNaN(y) || isNaN(parseFloat(positionInfo.y))) && (y = 0);
	        (isNaN(y2) || isNaN(parseFloat(positionInfo.y2))) && (y2 = containerHeight);

	        margin = formatUtil.normalizeCssArray(margin || 0);

	        return {
	            width: Math.max(x2 - x - margin[1] - margin[3], 0),
	            height: Math.max(y2 - y - margin[0] - margin[2], 0)
	        };
	    };

	    /**
	     * Parse position info.
	     *
	     * @param {Object} positionInfo
	     * @param {number|string} [positionInfo.left]
	     * @param {number|string} [positionInfo.top]
	     * @param {number|string} [positionInfo.right]
	     * @param {number|string} [positionInfo.bottom]
	     * @param {number|string} [positionInfo.width]
	     * @param {number|string} [positionInfo.height]
	     * @param {number|string} [positionInfo.aspect] Aspect is width / height
	     * @param {Object} containerRect
	     * @param {string|number} [margin]
	     *
	     * @return {module:zrender/core/BoundingRect}
	     */
	    layout.getLayoutRect = function (
	        positionInfo, containerRect, margin
	    ) {
	        margin = formatUtil.normalizeCssArray(margin || 0);

	        var containerWidth = containerRect.width;
	        var containerHeight = containerRect.height;

	        var left = parsePercent(positionInfo.left, containerWidth);
	        var top = parsePercent(positionInfo.top, containerHeight);
	        var right = parsePercent(positionInfo.right, containerWidth);
	        var bottom = parsePercent(positionInfo.bottom, containerHeight);
	        var width = parsePercent(positionInfo.width, containerWidth);
	        var height = parsePercent(positionInfo.height, containerHeight);

	        var verticalMargin = margin[2] + margin[0];
	        var horizontalMargin = margin[1] + margin[3];
	        var aspect = positionInfo.aspect;

	        // If width is not specified, calculate width from left and right
	        if (isNaN(width)) {
	            width = containerWidth - right - horizontalMargin - left;
	        }
	        if (isNaN(height)) {
	            height = containerHeight - bottom - verticalMargin - top;
	        }

	        // If width and height are not given
	        // 1. Graph should not exceeds the container
	        // 2. Aspect must be keeped
	        // 3. Graph should take the space as more as possible
	        if (isNaN(width) && isNaN(height)) {
	            if (aspect > containerWidth / containerHeight) {
	                width = containerWidth * 0.8;
	            }
	            else {
	                height = containerHeight * 0.8;
	            }
	        }

	        if (aspect != null) {
	            // Calculate width or height with given aspect
	            if (isNaN(width)) {
	                width = aspect * height;
	            }
	            if (isNaN(height)) {
	                height = width / aspect;
	            }
	        }

	        // If left is not specified, calculate left from right and width
	        if (isNaN(left)) {
	            left = containerWidth - right - width - horizontalMargin;
	        }
	        if (isNaN(top)) {
	            top = containerHeight - bottom - height - verticalMargin;
	        }

	        // Align left and top
	        switch (positionInfo.left || positionInfo.right) {
	            case 'center':
	                left = containerWidth / 2 - width / 2 - margin[3];
	                break;
	            case 'right':
	                left = containerWidth - width - horizontalMargin;
	                break;
	        }
	        switch (positionInfo.top || positionInfo.bottom) {
	            case 'middle':
	            case 'center':
	                top = containerHeight / 2 - height / 2 - margin[0];
	                break;
	            case 'bottom':
	                top = containerHeight - height - verticalMargin;
	                break;
	        }
	        // If something is wrong and left, top, width, height are calculated as NaN
	        left = left || 0;
	        top = top || 0;
	        if (isNaN(width)) {
	            // Width may be NaN if only one value is given except width
	            width = containerWidth - left - (right || 0);
	        }
	        if (isNaN(height)) {
	            // Height may be NaN if only one value is given except height
	            height = containerHeight - top - (bottom || 0);
	        }

	        var rect = new BoundingRect(left + margin[3], top + margin[0], width, height);
	        rect.margin = margin;
	        return rect;
	    };


	    /**
	     * Position a zr element in viewport
	     *  Group position is specified by either
	     *  {left, top}, {right, bottom}
	     *  If all properties exists, right and bottom will be igonred.
	     *
	     * Logic:
	     *     1. Scale (against origin point in parent coord)
	     *     2. Rotate (against origin point in parent coord)
	     *     3. Traslate (with el.position by this method)
	     * So this method only fixes the last step 'Traslate', which does not affect
	     * scaling and rotating.
	     *
	     * If be called repeatly with the same input el, the same result will be gotten.
	     *
	     * @param {module:zrender/Element} el Should have `getBoundingRect` method.
	     * @param {Object} positionInfo
	     * @param {number|string} [positionInfo.left]
	     * @param {number|string} [positionInfo.top]
	     * @param {number|string} [positionInfo.right]
	     * @param {number|string} [positionInfo.bottom]
	     * @param {Object} containerRect
	     * @param {string|number} margin
	     * @param {Object} [opt]
	     * @param {Array.<number>} [opt.hv=[1,1]] Only horizontal or only vertical.
	     * @param {Array.<number>} [opt.boundingMode='all']
	     *        Specify how to calculate boundingRect when locating.
	     *        'all': Position the boundingRect that is transformed and uioned
	     *               both itself and its descendants.
	     *               This mode simplies confine the elements in the bounding
	     *               of their container (e.g., using 'right: 0').
	     *        'raw': Position the boundingRect that is not transformed and only itself.
	     *               This mode is useful when you want a element can overflow its
	     *               container. (Consider a rotated circle needs to be located in a corner.)
	     *               In this mode positionInfo.width/height can only be number.
	     */
	    layout.positionElement = function (el, positionInfo, containerRect, margin, opt) {
	        var h = !opt || !opt.hv || opt.hv[0];
	        var v = !opt || !opt.hv || opt.hv[1];
	        var boundingMode = opt && opt.boundingMode || 'all';

	        if (!h && !v) {
	            return;
	        }

	        var rect;
	        if (boundingMode === 'raw') {
	            rect = el.type === 'group'
	                ? new BoundingRect(0, 0, +positionInfo.width || 0, +positionInfo.height || 0)
	                : el.getBoundingRect();
	        }
	        else {
	            rect = el.getBoundingRect();
	            if (el.needLocalTransform()) {
	                var transform = el.getLocalTransform();
	                // Notice: raw rect may be inner object of el,
	                // which should not be modified.
	                rect = rect.clone();
	                rect.applyTransform(transform);
	            }
	        }

	        positionInfo = layout.getLayoutRect(
	            zrUtil.defaults(
	                {width: rect.width, height: rect.height},
	                positionInfo
	            ),
	            containerRect,
	            margin
	        );

	        // Because 'tranlate' is the last step in transform
	        // (see zrender/core/Transformable#getLocalTransfrom),
	        // we can just only modify el.position to get final result.
	        var elPos = el.position;
	        var dx = h ? positionInfo.x - rect.x : 0;
	        var dy = v ? positionInfo.y - rect.y : 0;

	        el.attr('position', boundingMode === 'raw' ? [dx, dy] : [elPos[0] + dx, elPos[1] + dy]);
	    };

	    /**
	     * Consider Case:
	     * When defulat option has {left: 0, width: 100}, and we set {right: 0}
	     * through setOption or media query, using normal zrUtil.merge will cause
	     * {right: 0} does not take effect.
	     *
	     * @example
	     * ComponentModel.extend({
	     *     init: function () {
	     *         ...
	     *         var inputPositionParams = layout.getLayoutParams(option);
	     *         this.mergeOption(inputPositionParams);
	     *     },
	     *     mergeOption: function (newOption) {
	     *         newOption && zrUtil.merge(thisOption, newOption, true);
	     *         layout.mergeLayoutParam(thisOption, newOption);
	     *     }
	     * });
	     *
	     * @param {Object} targetOption
	     * @param {Object} newOption
	     * @param {Object|string} [opt]
	     * @param {boolean} [opt.ignoreSize=false] Some component must has width and height.
	     */
	    layout.mergeLayoutParam = function (targetOption, newOption, opt) {
	        !zrUtil.isObject(opt) && (opt = {});
	        var hNames = ['width', 'left', 'right']; // Order by priority.
	        var vNames = ['height', 'top', 'bottom']; // Order by priority.
	        var hResult = merge(hNames);
	        var vResult = merge(vNames);

	        copy(hNames, targetOption, hResult);
	        copy(vNames, targetOption, vResult);

	        function merge(names) {
	            var newParams = {};
	            var newValueCount = 0;
	            var merged = {};
	            var mergedValueCount = 0;
	            var enoughParamNumber = opt.ignoreSize ? 1 : 2;

	            each(names, function (name) {
	                merged[name] = targetOption[name];
	            });
	            each(names, function (name) {
	                // Consider case: newOption.width is null, which is
	                // set by user for removing width setting.
	                hasProp(newOption, name) && (newParams[name] = merged[name] = newOption[name]);
	                hasValue(newParams, name) && newValueCount++;
	                hasValue(merged, name) && mergedValueCount++;
	            });

	            // Case: newOption: {width: ..., right: ...},
	            // or targetOption: {right: ...} and newOption: {width: ...},
	            // There is no conflict when merged only has params count
	            // little than enoughParamNumber.
	            if (mergedValueCount === enoughParamNumber || !newValueCount) {
	                return merged;
	            }
	            // Case: newOption: {width: ..., right: ...},
	            // Than we can make sure user only want those two, and ignore
	            // all origin params in targetOption.
	            else if (newValueCount >= enoughParamNumber) {
	                return newParams;
	            }
	            else {
	                // Chose another param from targetOption by priority.
	                // When 'ignoreSize', enoughParamNumber is 1 and those will not happen.
	                for (var i = 0; i < names.length; i++) {
	                    var name = names[i];
	                    if (!hasProp(newParams, name) && hasProp(targetOption, name)) {
	                        newParams[name] = targetOption[name];
	                        break;
	                    }
	                }
	                return newParams;
	            }
	        }

	        function hasProp(obj, name) {
	            return obj.hasOwnProperty(name);
	        }

	        function hasValue(obj, name) {
	            return obj[name] != null && obj[name] !== 'auto';
	        }

	        function copy(names, target, source) {
	            each(names, function (name) {
	                target[name] = source[name];
	            });
	        }
	    };

	    /**
	     * Retrieve 'left', 'right', 'top', 'bottom', 'width', 'height' from object.
	     * @param {Object} source
	     * @return {Object} Result contains those props.
	     */
	    layout.getLayoutParams = function (source) {
	        return layout.copyLayoutParams({}, source);
	    };

	    /**
	     * Retrieve 'left', 'right', 'top', 'bottom', 'width', 'height' from object.
	     * @param {Object} source
	     * @return {Object} Result contains those props.
	     */
	    layout.copyLayoutParams = function (target, source) {
	        source && target && each(LOCATION_PARAMS, function (name) {
	            source.hasOwnProperty(name) && (target[name] = source[name]);
	        });
	        return target;
	    };

	    module.exports = layout;


/***/ },
/* 71 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	/**
	 * @module echarts/core/BoundingRect
	 */


	    var vec2 = __webpack_require__(72);
	    var matrix = __webpack_require__(73);

	    var v2ApplyTransform = vec2.applyTransform;
	    var mathMin = Math.min;
	    var mathMax = Math.max;
	    /**
	     * @alias module:echarts/core/BoundingRect
	     */
	    function BoundingRect(x, y, width, height) {

	        if (width < 0) {
	            x = x + width;
	            width = -width;
	        }
	        if (height < 0) {
	            y = y + height;
	            height = -height;
	        }

	        /**
	         * @type {number}
	         */
	        this.x = x;
	        /**
	         * @type {number}
	         */
	        this.y = y;
	        /**
	         * @type {number}
	         */
	        this.width = width;
	        /**
	         * @type {number}
	         */
	        this.height = height;
	    }

	    BoundingRect.prototype = {

	        constructor: BoundingRect,

	        /**
	         * @param {module:echarts/core/BoundingRect} other
	         */
	        union: function (other) {
	            var x = mathMin(other.x, this.x);
	            var y = mathMin(other.y, this.y);

	            this.width = mathMax(
	                    other.x + other.width,
	                    this.x + this.width
	                ) - x;
	            this.height = mathMax(
	                    other.y + other.height,
	                    this.y + this.height
	                ) - y;
	            this.x = x;
	            this.y = y;
	        },

	        /**
	         * @param {Array.<number>} m
	         * @methods
	         */
	        applyTransform: (function () {
	            var lt = [];
	            var rb = [];
	            var lb = [];
	            var rt = [];
	            return function (m) {
	                // In case usage like this
	                // el.getBoundingRect().applyTransform(el.transform)
	                // And element has no transform
	                if (!m) {
	                    return;
	                }
	                lt[0] = lb[0] = this.x;
	                lt[1] = rt[1] = this.y;
	                rb[0] = rt[0] = this.x + this.width;
	                rb[1] = lb[1] = this.y + this.height;

	                v2ApplyTransform(lt, lt, m);
	                v2ApplyTransform(rb, rb, m);
	                v2ApplyTransform(lb, lb, m);
	                v2ApplyTransform(rt, rt, m);

	                this.x = mathMin(lt[0], rb[0], lb[0], rt[0]);
	                this.y = mathMin(lt[1], rb[1], lb[1], rt[1]);
	                var maxX = mathMax(lt[0], rb[0], lb[0], rt[0]);
	                var maxY = mathMax(lt[1], rb[1], lb[1], rt[1]);
	                this.width = maxX - this.x;
	                this.height = maxY - this.y;
	            };
	        })(),

	        /**
	         * Calculate matrix of transforming from self to target rect
	         * @param  {module:zrender/core/BoundingRect} b
	         * @return {Array.<number>}
	         */
	        calculateTransform: function (b) {
	            var a = this;
	            var sx = b.width / a.width;
	            var sy = b.height / a.height;

	            var m = matrix.create();

	            // 矩阵右乘
	            matrix.translate(m, m, [-a.x, -a.y]);
	            matrix.scale(m, m, [sx, sy]);
	            matrix.translate(m, m, [b.x, b.y]);

	            return m;
	        },

	        /**
	         * @param {(module:echarts/core/BoundingRect|Object)} b
	         * @return {boolean}
	         */
	        intersect: function (b) {
	            if (!b) {
	                return false;
	            }

	            if (!(b instanceof BoundingRect)) {
	                // Normalize negative width/height.
	                b = BoundingRect.create(b);
	            }

	            var a = this;
	            var ax0 = a.x;
	            var ax1 = a.x + a.width;
	            var ay0 = a.y;
	            var ay1 = a.y + a.height;

	            var bx0 = b.x;
	            var bx1 = b.x + b.width;
	            var by0 = b.y;
	            var by1 = b.y + b.height;

	            return ! (ax1 < bx0 || bx1 < ax0 || ay1 < by0 || by1 < ay0);
	        },

	        contain: function (x, y) {
	            var rect = this;
	            return x >= rect.x
	                && x <= (rect.x + rect.width)
	                && y >= rect.y
	                && y <= (rect.y + rect.height);
	        },

	        /**
	         * @return {module:echarts/core/BoundingRect}
	         */
	        clone: function () {
	            return new BoundingRect(this.x, this.y, this.width, this.height);
	        },

	        /**
	         * Copy from another rect
	         */
	        copy: function (other) {
	            this.x = other.x;
	            this.y = other.y;
	            this.width = other.width;
	            this.height = other.height;
	        },

	        plain: function () {
	            return {
	                x: this.x,
	                y: this.y,
	                width: this.width,
	                height: this.height
	            };
	        }
	    };

	    /**
	     * @param {Object|module:zrender/core/BoundingRect} rect
	     * @param {number} rect.x
	     * @param {number} rect.y
	     * @param {number} rect.width
	     * @param {number} rect.height
	     * @return {module:zrender/core/BoundingRect}
	     */
	    BoundingRect.create = function (rect) {
	        return new BoundingRect(rect.x, rect.y, rect.width, rect.height);
	    };

	    module.exports = BoundingRect;


/***/ },
/* 72 */
/***/ function(module, exports) {

	
	    var ArrayCtor = typeof Float32Array === 'undefined'
	        ? Array
	        : Float32Array;

	    /**
	     * @typedef {Float32Array|Array.<number>} Vector2
	     */
	    /**
	     * 二维向量类
	     * @exports zrender/tool/vector
	     */
	    var vector = {
	        /**
	         * 创建一个向量
	         * @param {number} [x=0]
	         * @param {number} [y=0]
	         * @return {Vector2}
	         */
	        create: function (x, y) {
	            var out = new ArrayCtor(2);
	            if (x == null) {
	                x = 0;
	            }
	            if (y == null) {
	                y = 0;
	            }
	            out[0] = x;
	            out[1] = y;
	            return out;
	        },

	        /**
	         * 复制向量数据
	         * @param {Vector2} out
	         * @param {Vector2} v
	         * @return {Vector2}
	         */
	        copy: function (out, v) {
	            out[0] = v[0];
	            out[1] = v[1];
	            return out;
	        },

	        /**
	         * 克隆一个向量
	         * @param {Vector2} v
	         * @return {Vector2}
	         */
	        clone: function (v) {
	            var out = new ArrayCtor(2);
	            out[0] = v[0];
	            out[1] = v[1];
	            return out;
	        },

	        /**
	         * 设置向量的两个项
	         * @param {Vector2} out
	         * @param {number} a
	         * @param {number} b
	         * @return {Vector2} 结果
	         */
	        set: function (out, a, b) {
	            out[0] = a;
	            out[1] = b;
	            return out;
	        },

	        /**
	         * 向量相加
	         * @param {Vector2} out
	         * @param {Vector2} v1
	         * @param {Vector2} v2
	         */
	        add: function (out, v1, v2) {
	            out[0] = v1[0] + v2[0];
	            out[1] = v1[1] + v2[1];
	            return out;
	        },

	        /**
	         * 向量缩放后相加
	         * @param {Vector2} out
	         * @param {Vector2} v1
	         * @param {Vector2} v2
	         * @param {number} a
	         */
	        scaleAndAdd: function (out, v1, v2, a) {
	            out[0] = v1[0] + v2[0] * a;
	            out[1] = v1[1] + v2[1] * a;
	            return out;
	        },

	        /**
	         * 向量相减
	         * @param {Vector2} out
	         * @param {Vector2} v1
	         * @param {Vector2} v2
	         */
	        sub: function (out, v1, v2) {
	            out[0] = v1[0] - v2[0];
	            out[1] = v1[1] - v2[1];
	            return out;
	        },

	        /**
	         * 向量长度
	         * @param {Vector2} v
	         * @return {number}
	         */
	        len: function (v) {
	            return Math.sqrt(this.lenSquare(v));
	        },

	        /**
	         * 向量长度平方
	         * @param {Vector2} v
	         * @return {number}
	         */
	        lenSquare: function (v) {
	            return v[0] * v[0] + v[1] * v[1];
	        },

	        /**
	         * 向量乘法
	         * @param {Vector2} out
	         * @param {Vector2} v1
	         * @param {Vector2} v2
	         */
	        mul: function (out, v1, v2) {
	            out[0] = v1[0] * v2[0];
	            out[1] = v1[1] * v2[1];
	            return out;
	        },

	        /**
	         * 向量除法
	         * @param {Vector2} out
	         * @param {Vector2} v1
	         * @param {Vector2} v2
	         */
	        div: function (out, v1, v2) {
	            out[0] = v1[0] / v2[0];
	            out[1] = v1[1] / v2[1];
	            return out;
	        },

	        /**
	         * 向量点乘
	         * @param {Vector2} v1
	         * @param {Vector2} v2
	         * @return {number}
	         */
	        dot: function (v1, v2) {
	            return v1[0] * v2[0] + v1[1] * v2[1];
	        },

	        /**
	         * 向量缩放
	         * @param {Vector2} out
	         * @param {Vector2} v
	         * @param {number} s
	         */
	        scale: function (out, v, s) {
	            out[0] = v[0] * s;
	            out[1] = v[1] * s;
	            return out;
	        },

	        /**
	         * 向量归一化
	         * @param {Vector2} out
	         * @param {Vector2} v
	         */
	        normalize: function (out, v) {
	            var d = vector.len(v);
	            if (d === 0) {
	                out[0] = 0;
	                out[1] = 0;
	            }
	            else {
	                out[0] = v[0] / d;
	                out[1] = v[1] / d;
	            }
	            return out;
	        },

	        /**
	         * 计算向量间距离
	         * @param {Vector2} v1
	         * @param {Vector2} v2
	         * @return {number}
	         */
	        distance: function (v1, v2) {
	            return Math.sqrt(
	                (v1[0] - v2[0]) * (v1[0] - v2[0])
	                + (v1[1] - v2[1]) * (v1[1] - v2[1])
	            );
	        },

	        /**
	         * 向量距离平方
	         * @param {Vector2} v1
	         * @param {Vector2} v2
	         * @return {number}
	         */
	        distanceSquare: function (v1, v2) {
	            return (v1[0] - v2[0]) * (v1[0] - v2[0])
	                + (v1[1] - v2[1]) * (v1[1] - v2[1]);
	        },

	        /**
	         * 求负向量
	         * @param {Vector2} out
	         * @param {Vector2} v
	         */
	        negate: function (out, v) {
	            out[0] = -v[0];
	            out[1] = -v[1];
	            return out;
	        },

	        /**
	         * 插值两个点
	         * @param {Vector2} out
	         * @param {Vector2} v1
	         * @param {Vector2} v2
	         * @param {number} t
	         */
	        lerp: function (out, v1, v2, t) {
	            out[0] = v1[0] + t * (v2[0] - v1[0]);
	            out[1] = v1[1] + t * (v2[1] - v1[1]);
	            return out;
	        },

	        /**
	         * 矩阵左乘向量
	         * @param {Vector2} out
	         * @param {Vector2} v
	         * @param {Vector2} m
	         */
	        applyTransform: function (out, v, m) {
	            var x = v[0];
	            var y = v[1];
	            out[0] = m[0] * x + m[2] * y + m[4];
	            out[1] = m[1] * x + m[3] * y + m[5];
	            return out;
	        },
	        /**
	         * 求两个向量最小值
	         * @param  {Vector2} out
	         * @param  {Vector2} v1
	         * @param  {Vector2} v2
	         */
	        min: function (out, v1, v2) {
	            out[0] = Math.min(v1[0], v2[0]);
	            out[1] = Math.min(v1[1], v2[1]);
	            return out;
	        },
	        /**
	         * 求两个向量最大值
	         * @param  {Vector2} out
	         * @param  {Vector2} v1
	         * @param  {Vector2} v2
	         */
	        max: function (out, v1, v2) {
	            out[0] = Math.max(v1[0], v2[0]);
	            out[1] = Math.max(v1[1], v2[1]);
	            return out;
	        }
	    };

	    vector.length = vector.len;
	    vector.lengthSquare = vector.lenSquare;
	    vector.dist = vector.distance;
	    vector.distSquare = vector.distanceSquare;

	    module.exports = vector;



/***/ },
/* 73 */
/***/ function(module, exports) {

	
	    var ArrayCtor = typeof Float32Array === 'undefined'
	        ? Array
	        : Float32Array;
	    /**
	     * 3x2矩阵操作类
	     * @exports zrender/tool/matrix
	     */
	    var matrix = {
	        /**
	         * 创建一个单位矩阵
	         * @return {Float32Array|Array.<number>}
	         */
	        create : function() {
	            var out = new ArrayCtor(6);
	            matrix.identity(out);

	            return out;
	        },
	        /**
	         * 设置矩阵为单位矩阵
	         * @param {Float32Array|Array.<number>} out
	         */
	        identity : function(out) {
	            out[0] = 1;
	            out[1] = 0;
	            out[2] = 0;
	            out[3] = 1;
	            out[4] = 0;
	            out[5] = 0;
	            return out;
	        },
	        /**
	         * 复制矩阵
	         * @param {Float32Array|Array.<number>} out
	         * @param {Float32Array|Array.<number>} m
	         */
	        copy: function(out, m) {
	            out[0] = m[0];
	            out[1] = m[1];
	            out[2] = m[2];
	            out[3] = m[3];
	            out[4] = m[4];
	            out[5] = m[5];
	            return out;
	        },
	        /**
	         * 矩阵相乘
	         * @param {Float32Array|Array.<number>} out
	         * @param {Float32Array|Array.<number>} m1
	         * @param {Float32Array|Array.<number>} m2
	         */
	        mul : function (out, m1, m2) {
	            // Consider matrix.mul(m, m2, m);
	            // where out is the same as m2.
	            // So use temp variable to escape error.
	            var out0 = m1[0] * m2[0] + m1[2] * m2[1];
	            var out1 = m1[1] * m2[0] + m1[3] * m2[1];
	            var out2 = m1[0] * m2[2] + m1[2] * m2[3];
	            var out3 = m1[1] * m2[2] + m1[3] * m2[3];
	            var out4 = m1[0] * m2[4] + m1[2] * m2[5] + m1[4];
	            var out5 = m1[1] * m2[4] + m1[3] * m2[5] + m1[5];
	            out[0] = out0;
	            out[1] = out1;
	            out[2] = out2;
	            out[3] = out3;
	            out[4] = out4;
	            out[5] = out5;
	            return out;
	        },
	        /**
	         * 平移变换
	         * @param {Float32Array|Array.<number>} out
	         * @param {Float32Array|Array.<number>} a
	         * @param {Float32Array|Array.<number>} v
	         */
	        translate : function(out, a, v) {
	            out[0] = a[0];
	            out[1] = a[1];
	            out[2] = a[2];
	            out[3] = a[3];
	            out[4] = a[4] + v[0];
	            out[5] = a[5] + v[1];
	            return out;
	        },
	        /**
	         * 旋转变换
	         * @param {Float32Array|Array.<number>} out
	         * @param {Float32Array|Array.<number>} a
	         * @param {number} rad
	         */
	        rotate : function(out, a, rad) {
	            var aa = a[0];
	            var ac = a[2];
	            var atx = a[4];
	            var ab = a[1];
	            var ad = a[3];
	            var aty = a[5];
	            var st = Math.sin(rad);
	            var ct = Math.cos(rad);

	            out[0] = aa * ct + ab * st;
	            out[1] = -aa * st + ab * ct;
	            out[2] = ac * ct + ad * st;
	            out[3] = -ac * st + ct * ad;
	            out[4] = ct * atx + st * aty;
	            out[5] = ct * aty - st * atx;
	            return out;
	        },
	        /**
	         * 缩放变换
	         * @param {Float32Array|Array.<number>} out
	         * @param {Float32Array|Array.<number>} a
	         * @param {Float32Array|Array.<number>} v
	         */
	        scale : function(out, a, v) {
	            var vx = v[0];
	            var vy = v[1];
	            out[0] = a[0] * vx;
	            out[1] = a[1] * vy;
	            out[2] = a[2] * vx;
	            out[3] = a[3] * vy;
	            out[4] = a[4] * vx;
	            out[5] = a[5] * vy;
	            return out;
	        },
	        /**
	         * 求逆矩阵
	         * @param {Float32Array|Array.<number>} out
	         * @param {Float32Array|Array.<number>} a
	         */
	        invert : function(out, a) {

	            var aa = a[0];
	            var ac = a[2];
	            var atx = a[4];
	            var ab = a[1];
	            var ad = a[3];
	            var aty = a[5];

	            var det = aa * ad - ab * ac;
	            if (!det) {
	                return null;
	            }
	            det = 1.0 / det;

	            out[0] = ad * det;
	            out[1] = -ab * det;
	            out[2] = -ac * det;
	            out[3] = aa * det;
	            out[4] = (ac * aty - ad * atx) * det;
	            out[5] = (ab * atx - aa * aty) * det;
	            return out;
	        }
	    };

	    module.exports = matrix;



/***/ },
/* 74 */
/***/ function(module, exports) {

	/**
	 * 数值处理模块
	 * @module echarts/util/number
	 */



	    var number = {};

	    var RADIAN_EPSILON = 1e-4;

	    function _trim(str) {
	        return str.replace(/^\s+/, '').replace(/\s+$/, '');
	    }

	    /**
	     * Linear mapping a value from domain to range
	     * @memberOf module:echarts/util/number
	     * @param  {(number|Array.<number>)} val
	     * @param  {Array.<number>} domain Domain extent domain[0] can be bigger than domain[1]
	     * @param  {Array.<number>} range  Range extent range[0] can be bigger than range[1]
	     * @param  {boolean} clamp
	     * @return {(number|Array.<number>}
	     */
	    number.linearMap = function (val, domain, range, clamp) {
	        var subDomain = domain[1] - domain[0];
	        var subRange = range[1] - range[0];

	        if (subDomain === 0) {
	            return subRange === 0
	                ? range[0]
	                : (range[0] + range[1]) / 2;
	        }

	        // Avoid accuracy problem in edge, such as
	        // 146.39 - 62.83 === 83.55999999999999.
	        // See echarts/test/ut/spec/util/number.js#linearMap#accuracyError
	        // It is a little verbose for efficiency considering this method
	        // is a hotspot.
	        if (clamp) {
	            if (subDomain > 0) {
	                if (val <= domain[0]) {
	                    return range[0];
	                }
	                else if (val >= domain[1]) {
	                    return range[1];
	                }
	            }
	            else {
	                if (val >= domain[0]) {
	                    return range[0];
	                }
	                else if (val <= domain[1]) {
	                    return range[1];
	                }
	            }
	        }
	        else {
	            if (val === domain[0]) {
	                return range[0];
	            }
	            if (val === domain[1]) {
	                return range[1];
	            }
	        }

	        return (val - domain[0]) / subDomain * subRange + range[0];
	    };

	    /**
	     * Convert a percent string to absolute number.
	     * Returns NaN if percent is not a valid string or number
	     * @memberOf module:echarts/util/number
	     * @param {string|number} percent
	     * @param {number} all
	     * @return {number}
	     */
	    number.parsePercent = function(percent, all) {
	        switch (percent) {
	            case 'center':
	            case 'middle':
	                percent = '50%';
	                break;
	            case 'left':
	            case 'top':
	                percent = '0%';
	                break;
	            case 'right':
	            case 'bottom':
	                percent = '100%';
	                break;
	        }
	        if (typeof percent === 'string') {
	            if (_trim(percent).match(/%$/)) {
	                return parseFloat(percent) / 100 * all;
	            }

	            return parseFloat(percent);
	        }

	        return percent == null ? NaN : +percent;
	    };

	    /**
	     * Fix rounding error of float numbers
	     * @param {number} x
	     * @return {number}
	     */
	    number.round = function (x, precision) {
	        if (precision == null) {
	            precision = 10;
	        }
	        // Avoid range error
	        precision = Math.min(Math.max(0, precision), 20);
	        return +(+x).toFixed(precision);
	    };

	    number.asc = function (arr) {
	        arr.sort(function (a, b) {
	            return a - b;
	        });
	        return arr;
	    };

	    /**
	     * Get precision
	     * @param {number} val
	     */
	    number.getPrecision = function (val) {
	        val = +val;
	        if (isNaN(val)) {
	            return 0;
	        }
	        // It is much faster than methods converting number to string as follows
	        //      var tmp = val.toString();
	        //      return tmp.length - 1 - tmp.indexOf('.');
	        // especially when precision is low
	        var e = 1;
	        var count = 0;
	        while (Math.round(val * e) / e !== val) {
	            e *= 10;
	            count++;
	        }
	        return count;
	    };

	    number.getPrecisionSafe = function (val) {
	        var str = val.toString();
	        var dotIndex = str.indexOf('.');
	        if (dotIndex < 0) {
	            return 0;
	        }
	        return str.length - 1 - dotIndex;
	    };

	    /**
	     * Minimal dicernible data precisioin according to a single pixel.
	     * @param {Array.<number>} dataExtent
	     * @param {Array.<number>} pixelExtent
	     * @return {number} precision
	     */
	    number.getPixelPrecision = function (dataExtent, pixelExtent) {
	        var log = Math.log;
	        var LN10 = Math.LN10;
	        var dataQuantity = Math.floor(log(dataExtent[1] - dataExtent[0]) / LN10);
	        var sizeQuantity = Math.round(log(Math.abs(pixelExtent[1] - pixelExtent[0])) / LN10);
	        // toFixed() digits argument must be between 0 and 20.
	        var precision = Math.min(Math.max(-dataQuantity + sizeQuantity, 0), 20);
	        return !isFinite(precision) ? 20 : precision;
	    };

	    // Number.MAX_SAFE_INTEGER, ie do not support.
	    number.MAX_SAFE_INTEGER = 9007199254740991;

	    /**
	     * To 0 - 2 * PI, considering negative radian.
	     * @param {number} radian
	     * @return {number}
	     */
	    number.remRadian = function (radian) {
	        var pi2 = Math.PI * 2;
	        return (radian % pi2 + pi2) % pi2;
	    };

	    /**
	     * @param {type} radian
	     * @return {boolean}
	     */
	    number.isRadianAroundZero = function (val) {
	        return val > -RADIAN_EPSILON && val < RADIAN_EPSILON;
	    };

	    /**
	     * @param {string|Date|number} value
	     * @return {Date} date
	     */
	    number.parseDate = function (value) {
	        if (value instanceof Date) {
	            return value;
	        }
	        else if (typeof value === 'string') {
	            // Treat as ISO format. See issue #3623
	            var ret = new Date(value);
	            if (isNaN(+ret)) {
	                // FIXME new Date('1970-01-01') is UTC, new Date('1970/01/01') is local
	                ret = new Date(new Date(value.replace(/-/g, '/')) - new Date('1970/01/01'));
	            }
	            return ret;
	        }

	        return new Date(Math.round(value));
	    };

	    /**
	     * Quantity of a number. e.g. 0.1, 1, 10, 100
	     * @param  {number} val
	     * @return {number}
	     */
	    number.quantity = function (val) {
	        return Math.pow(10, Math.floor(Math.log(val) / Math.LN10));
	    };

	    // "Nice Numbers for Graph Labels" of Graphic Gems
	    /**
	     * find a “nice” number approximately equal to x. Round the number if round = true, take ceiling if round = false
	     * The primary observation is that the “nicest” numbers in decimal are 1, 2, and 5, and all power-of-ten multiples of these numbers.
	     * @param  {number} val
	     * @param  {boolean} round
	     * @return {number}
	     */
	    number.nice = function (val, round) {
	        var exp10 = number.quantity(val);
	        var f = val / exp10; // between 1 and 10
	        var nf;
	        if (round) {
	            if (f < 1.5) { nf = 1; }
	            else if (f < 2.5) { nf = 2; }
	            else if (f < 4) { nf = 3; }
	            else if (f < 7) { nf = 5; }
	            else { nf = 10; }
	        }
	        else {
	            if (f < 1) { nf = 1; }
	            else if (f < 2) { nf = 2; }
	            else if (f < 3) { nf = 3; }
	            else if (f < 5) { nf = 5; }
	            else { nf = 10; }
	        }
	        return nf * exp10;
	    };

	    /**
	     * Order intervals asc, and split them when overlap.
	     * expect(numberUtil.reformIntervals([
	     *     {interval: [18, 62], close: [1, 1]},
	     *     {interval: [-Infinity, -70], close: [0, 0]},
	     *     {interval: [-70, -26], close: [1, 1]},
	     *     {interval: [-26, 18], close: [1, 1]},
	     *     {interval: [62, 150], close: [1, 1]},
	     *     {interval: [106, 150], close: [1, 1]},
	     *     {interval: [150, Infinity], close: [0, 0]}
	     * ])).toEqual([
	     *     {interval: [-Infinity, -70], close: [0, 0]},
	     *     {interval: [-70, -26], close: [1, 1]},
	     *     {interval: [-26, 18], close: [0, 1]},
	     *     {interval: [18, 62], close: [0, 1]},
	     *     {interval: [62, 150], close: [0, 1]},
	     *     {interval: [150, Infinity], close: [0, 0]}
	     * ]);
	     * @param {Array.<Object>} list, where `close` mean open or close
	     *        of the interval, and Infinity can be used.
	     * @return {Array.<Object>} The origin list, which has been reformed.
	     */
	    number.reformIntervals = function (list) {
	        list.sort(function (a, b) {
	            return littleThan(a, b, 0) ? -1 : 1;
	        });

	        var curr = -Infinity;
	        var currClose = 1;
	        for (var i = 0; i < list.length;) {
	            var interval = list[i].interval;
	            var close = list[i].close;

	            for (var lg = 0; lg < 2; lg++) {
	                if (interval[lg] <= curr) {
	                    interval[lg] = curr;
	                    close[lg] = !lg ? 1 - currClose : 1;
	                }
	                curr = interval[lg];
	                currClose = close[lg];
	            }

	            if (interval[0] === interval[1] && close[0] * close[1] !== 1) {
	                list.splice(i, 1);
	            }
	            else {
	                i++;
	            }
	        }

	        return list;

	        function littleThan(a, b, lg) {
	            return a.interval[lg] < b.interval[lg]
	                || (
	                    a.interval[lg] === b.interval[lg]
	                    && (
	                        (a.close[lg] - b.close[lg] === (!lg ? 1 : -1))
	                        || (!lg && littleThan(a, b, 1))
	                    )
	                );
	        }
	    };

	    /**
	     * parseFloat NaNs numeric-cast false positives (null|true|false|"")
	     * ...but misinterprets leading-number strings, particularly hex literals ("0x...")
	     * subtraction forces infinities to NaN
	     * @param {*} v
	     * @return {boolean}
	     */
	    number.isNumeric = function (v) {
	        return v - parseFloat(v) >= 0;
	    };

	    module.exports = number;


/***/ },
/* 75 */
/***/ function(module, exports, __webpack_require__) {

	

	    var zrUtil = __webpack_require__(34);
	    var numberUtil = __webpack_require__(74);
	    var textContain = __webpack_require__(76);

	    var formatUtil = {};
	    /**
	     * 每三位默认加,格式化
	     * @type {string|number} x
	     */
	    formatUtil.addCommas = function (x) {
	        if (isNaN(x)) {
	            return '-';
	        }
	        x = (x + '').split('.');
	        return x[0].replace(/(\d{1,3})(?=(?:\d{3})+(?!\d))/g,'$1,')
	               + (x.length > 1 ? ('.' + x[1]) : '');
	    };

	    /**
	     * @param {string} str
	     * @param {boolean} [upperCaseFirst=false]
	     * @return {string} str
	     */
	    formatUtil.toCamelCase = function (str, upperCaseFirst) {
	        str = (str || '').toLowerCase().replace(/-(.)/g, function(match, group1) {
	            return group1.toUpperCase();
	        });

	        if (upperCaseFirst && str) {
	            str = str.charAt(0).toUpperCase() + str.slice(1);
	        }

	        return str;
	    };

	    /**
	     * Normalize css liked array configuration
	     * e.g.
	     *  3 => [3, 3, 3, 3]
	     *  [4, 2] => [4, 2, 4, 2]
	     *  [4, 3, 2] => [4, 3, 2, 3]
	     * @param {number|Array.<number>} val
	     */
	    formatUtil.normalizeCssArray = function (val) {
	        var len = val.length;
	        if (typeof (val) === 'number') {
	            return [val, val, val, val];
	        }
	        else if (len === 2) {
	            // vertical | horizontal
	            return [val[0], val[1], val[0], val[1]];
	        }
	        else if (len === 3) {
	            // top | horizontal | bottom
	            return [val[0], val[1], val[2], val[1]];
	        }
	        return val;
	    };

	    var encodeHTML = formatUtil.encodeHTML = function (source) {
	        return String(source)
	            .replace(/&/g, '&amp;')
	            .replace(/</g, '&lt;')
	            .replace(/>/g, '&gt;')
	            .replace(/"/g, '&quot;')
	            .replace(/'/g, '&#39;');
	    };

	    var TPL_VAR_ALIAS = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

	    var wrapVar = function (varName, seriesIdx) {
	        return '{' + varName + (seriesIdx == null ? '' : seriesIdx) + '}';
	    };

	    /**
	     * Template formatter
	     * @param {string} tpl
	     * @param {Array.<Object>|Object} paramsList
	     * @param {boolean} [encode=false]
	     * @return {string}
	     */
	    formatUtil.formatTpl = function (tpl, paramsList, encode) {
	        if (!zrUtil.isArray(paramsList)) {
	            paramsList = [paramsList];
	        }
	        var seriesLen = paramsList.length;
	        if (!seriesLen) {
	            return '';
	        }

	        var $vars = paramsList[0].$vars || [];
	        for (var i = 0; i < $vars.length; i++) {
	            var alias = TPL_VAR_ALIAS[i];
	            var val = wrapVar(alias, 0);
	            tpl = tpl.replace(wrapVar(alias), encode ? encodeHTML(val) : val);
	        }
	        for (var seriesIdx = 0; seriesIdx < seriesLen; seriesIdx++) {
	            for (var k = 0; k < $vars.length; k++) {
	                var val = paramsList[seriesIdx][$vars[k]];
	                tpl = tpl.replace(
	                    wrapVar(TPL_VAR_ALIAS[k], seriesIdx),
	                    encode ? encodeHTML(val) : val
	                );
	            }
	        }

	        return tpl;
	    };


	    /**
	     * @param {string} str
	     * @return {string}
	     * @inner
	     */
	    var s2d = function (str) {
	        return str < 10 ? ('0' + str) : str;
	    };

	    /**
	     * ISO Date format
	     * @param {string} tpl
	     * @param {number} value
	     * @inner
	     */
	    formatUtil.formatTime = function (tpl, value) {
	        if (tpl === 'week'
	            || tpl === 'month'
	            || tpl === 'quarter'
	            || tpl === 'half-year'
	            || tpl === 'year'
	        ) {
	            tpl = 'MM-dd\nyyyy';
	        }

	        var date = numberUtil.parseDate(value);
	        var y = date.getFullYear();
	        var M = date.getMonth() + 1;
	        var d = date.getDate();
	        var h = date.getHours();
	        var m = date.getMinutes();
	        var s = date.getSeconds();

	        tpl = tpl.replace('MM', s2d(M))
	            .toLowerCase()
	            .replace('yyyy', y)
	            .replace('yy', y % 100)
	            .replace('dd', s2d(d))
	            .replace('d', d)
	            .replace('hh', s2d(h))
	            .replace('h', h)
	            .replace('mm', s2d(m))
	            .replace('m', m)
	            .replace('ss', s2d(s))
	            .replace('s', s);

	        return tpl;
	    };

	    /**
	     * Capital first
	     * @param {string} str
	     * @return {string}
	     */
	    formatUtil.capitalFirst = function (str) {
	        return str ? str.charAt(0).toUpperCase() + str.substr(1) : str;
	    };

	    formatUtil.truncateText = textContain.truncateText;

	    module.exports = formatUtil;


/***/ },
/* 76 */
/***/ function(module, exports, __webpack_require__) {

	

	    var textWidthCache = {};
	    var textWidthCacheCounter = 0;
	    var TEXT_CACHE_MAX = 5000;

	    var util = __webpack_require__(34);
	    var BoundingRect = __webpack_require__(71);
	    var retrieve = util.retrieve;

	    function getTextWidth(text, textFont) {
	        var key = text + ':' + textFont;
	        if (textWidthCache[key]) {
	            return textWidthCache[key];
	        }

	        var textLines = (text + '').split('\n');
	        var width = 0;

	        for (var i = 0, l = textLines.length; i < l; i++) {
	            // measureText 可以被覆盖以兼容不支持 Canvas 的环境
	            width = Math.max(textContain.measureText(textLines[i], textFont).width, width);
	        }

	        if (textWidthCacheCounter > TEXT_CACHE_MAX) {
	            textWidthCacheCounter = 0;
	            textWidthCache = {};
	        }
	        textWidthCacheCounter++;
	        textWidthCache[key] = width;

	        return width;
	    }

	    function getTextRect(text, textFont, textAlign, textBaseline) {
	        var textLineLen = ((text || '') + '').split('\n').length;

	        var width = getTextWidth(text, textFont);
	        // FIXME 高度计算比较粗暴
	        var lineHeight = getTextWidth('国', textFont);
	        var height = textLineLen * lineHeight;

	        var rect = new BoundingRect(0, 0, width, height);
	        // Text has a special line height property
	        rect.lineHeight = lineHeight;

	        switch (textBaseline) {
	            case 'bottom':
	            case 'alphabetic':
	                rect.y -= lineHeight;
	                break;
	            case 'middle':
	                rect.y -= lineHeight / 2;
	                break;
	            // case 'hanging':
	            // case 'top':
	        }

	        // FIXME Right to left language
	        switch (textAlign) {
	            case 'end':
	            case 'right':
	                rect.x -= rect.width;
	                break;
	            case 'center':
	                rect.x -= rect.width / 2;
	                break;
	            // case 'start':
	            // case 'left':
	        }

	        return rect;
	    }

	    function adjustTextPositionOnRect(textPosition, rect, textRect, distance) {

	        var x = rect.x;
	        var y = rect.y;

	        var height = rect.height;
	        var width = rect.width;

	        var textHeight = textRect.height;

	        var halfHeight = height / 2 - textHeight / 2;

	        var textAlign = 'left';

	        switch (textPosition) {
	            case 'left':
	                x -= distance;
	                y += halfHeight;
	                textAlign = 'right';
	                break;
	            case 'right':
	                x += distance + width;
	                y += halfHeight;
	                textAlign = 'left';
	                break;
	            case 'top':
	                x += width / 2;
	                y -= distance + textHeight;
	                textAlign = 'center';
	                break;
	            case 'bottom':
	                x += width / 2;
	                y += height + distance;
	                textAlign = 'center';
	                break;
	            case 'inside':
	                x += width / 2;
	                y += halfHeight;
	                textAlign = 'center';
	                break;
	            case 'insideLeft':
	                x += distance;
	                y += halfHeight;
	                textAlign = 'left';
	                break;
	            case 'insideRight':
	                x += width - distance;
	                y += halfHeight;
	                textAlign = 'right';
	                break;
	            case 'insideTop':
	                x += width / 2;
	                y += distance;
	                textAlign = 'center';
	                break;
	            case 'insideBottom':
	                x += width / 2;
	                y += height - textHeight - distance;
	                textAlign = 'center';
	                break;
	            case 'insideTopLeft':
	                x += distance;
	                y += distance;
	                textAlign = 'left';
	                break;
	            case 'insideTopRight':
	                x += width - distance;
	                y += distance;
	                textAlign = 'right';
	                break;
	            case 'insideBottomLeft':
	                x += distance;
	                y += height - textHeight - distance;
	                break;
	            case 'insideBottomRight':
	                x += width - distance;
	                y += height - textHeight - distance;
	                textAlign = 'right';
	                break;
	        }

	        return {
	            x: x,
	            y: y,
	            textAlign: textAlign,
	            textBaseline: 'top'
	        };
	    }

	    /**
	     * Show ellipsis if overflow.
	     *
	     * @param  {string} text
	     * @param  {string} containerWidth
	     * @param  {string} textFont
	     * @param  {number} [ellipsis='...']
	     * @param  {Object} [options]
	     * @param  {number} [options.maxIterations=3]
	     * @param  {number} [options.minChar=0] If truncate result are less
	     *                  then minChar, ellipsis will not show, which is
	     *                  better for user hint in some cases.
	     * @param  {number} [options.placeholder=''] When all truncated, use the placeholder.
	     * @return {string}
	     */
	    function truncateText(text, containerWidth, textFont, ellipsis, options) {
	        if (!containerWidth) {
	            return '';
	        }

	        options = options || {};

	        ellipsis = retrieve(ellipsis, '...');
	        var maxIterations = retrieve(options.maxIterations, 2);
	        var minChar = retrieve(options.minChar, 0);
	        // FIXME
	        // Other languages?
	        var cnCharWidth = getTextWidth('国', textFont);
	        // FIXME
	        // Consider proportional font?
	        var ascCharWidth = getTextWidth('a', textFont);
	        var placeholder = retrieve(options.placeholder, '');

	        // Example 1: minChar: 3, text: 'asdfzxcv', truncate result: 'asdf', but not: 'a...'.
	        // Example 2: minChar: 3, text: '维度', truncate result: '维', but not: '...'.
	        var contentWidth = containerWidth = Math.max(0, containerWidth - 1); // Reserve some gap.
	        for (var i = 0; i < minChar && contentWidth >= ascCharWidth; i++) {
	            contentWidth -= ascCharWidth;
	        }

	        var ellipsisWidth = getTextWidth(ellipsis);
	        if (ellipsisWidth > contentWidth) {
	            ellipsis = '';
	            ellipsisWidth = 0;
	        }

	        contentWidth = containerWidth - ellipsisWidth;

	        var textLines = (text + '').split('\n');

	        for (var i = 0, len = textLines.length; i < len; i++) {
	            var textLine = textLines[i];
	            var lineWidth = getTextWidth(textLine, textFont);

	            if (lineWidth <= containerWidth) {
	                continue;
	            }

	            for (var j = 0;; j++) {
	                if (lineWidth <= contentWidth || j >= maxIterations) {
	                    textLine += ellipsis;
	                    break;
	                }

	                var subLength = j === 0
	                    ? estimateLength(textLine, contentWidth, ascCharWidth, cnCharWidth)
	                    : lineWidth > 0
	                    ? Math.floor(textLine.length * contentWidth / lineWidth)
	                    : 0;

	                textLine = textLine.substr(0, subLength);
	                lineWidth = getTextWidth(textLine, textFont);
	            }

	            if (textLine === '') {
	                textLine = placeholder;
	            }

	            textLines[i] = textLine;
	        }

	        return textLines.join('\n');
	    }

	    function estimateLength(text, contentWidth, ascCharWidth, cnCharWidth) {
	        var width = 0;
	        var i = 0;
	        for (var len = text.length; i < len && width < contentWidth; i++) {
	            var charCode = text.charCodeAt(i);
	            width += (0 <= charCode && charCode <= 127) ? ascCharWidth : cnCharWidth;
	        }
	        return i;
	    }

	    var textContain = {

	        getWidth: getTextWidth,

	        getBoundingRect: getTextRect,

	        adjustTextPositionOnRect: adjustTextPositionOnRect,

	        truncateText: truncateText,

	        measureText: function (text, textFont) {
	            var ctx = util.getContext();
	            ctx.font = textFont || '12px sans-serif';
	            return ctx.measureText(text);
	        }
	    };

	    module.exports = textContain;


/***/ },
/* 77 */
/***/ function(module, exports, __webpack_require__) {

	/*
	 * @module echarts-gl/core/ViewGL
	 * @author Yi Shen(http://github.com/pissang)
	 */

	var Scene = __webpack_require__(43);
	var PerspectiveCamera = __webpack_require__(78);
	var OrthographicCamera = __webpack_require__(80);


	/**
	 * @constructor
	 * @alias module:echarts-gl/core/ViewGL
	 * @param {string} [cameraType='perspective']
	 */
	function ViewGL(cameraType) {

	    cameraType = cameraType || 'perspective';

	    /**
	     * @type {module:echarts-gl/core/LayerGL}
	     */
	    this.layer = null;
	    /**
	     * @type {qtek.Scene}
	     */
	    this.scene = new Scene();

	    this.viewport = {
	        x: 0, y: 0, width: 0, height: 0
	    };

	    this.setCameraType(cameraType);

	}

	/**
	 * Set camera type of group
	 * @param {string} cameraType 'perspective' | 'orthographic'
	 */
	ViewGL.prototype.setCameraType = function (cameraType) {
	    this.camera = cameraType === 'perspective'
	        ? new PerspectiveCamera() : new OrthographicCamera();
	};

	/**
	 * Set viewport of group
	 * @param {number} x Viewport left bottom x
	 * @param {number} y Viewport left bottom y
	 * @param {number} width Viewport height
	 * @param {number} height Viewport height
	 */
	ViewGL.prototype.setViewport = function (x, y, width, height) {
	    if (this.camera instanceof PerspectiveCamera) {
	        this.camera.aspect = width / height;
	    }

	    this.viewport.x = x;
	    this.viewport.y = y;
	    this.viewport.width = width;
	    this.viewport.height = height;
	};


	/**
	 * If contain screen point x, y
	 */
	ViewGL.prototype.containPoint = function (x, y) {
	    var viewport = this.viewport;
	    return x >= viewport.x && y >= viewport.y
	        && x <= viewport.x + viewport.width && y <= viewport.y + viewport.height;
	};

	// Proxies
	ViewGL.prototype.add = function (node3D) {
	    this.scene.add(node3D);
	};
	ViewGL.prototype.remove = function (node3D) {
	    this.scene.remove(node3D);
	};
	ViewGL.prototype.removeAll = function (node3D) {
	    this.scene.removeAll(node3D);
	};


	module.exports = ViewGL;

/***/ },
/* 78 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';


	    var Camera = __webpack_require__(79);

	    /**
	     * @constructor qtek.camera.Perspective
	     * @extends qtek.Camera
	     */
	    var Perspective = Camera.extend(
	    /** @lends qtek.camera.Perspective# */
	    {
	        /**
	         * Vertical field of view in radians
	         * @type {number}
	         */
	        fov: 50,
	        /**
	         * Aspect ratio, typically viewport width / height
	         * @type {number}
	         */
	        aspect: 1,
	        /**
	         * Near bound of the frustum
	         * @type {number}
	         */
	        near: 0.1,
	        /**
	         * Far bound of the frustum
	         * @type {number}
	         */
	        far: 2000
	    },
	    /** @lends qtek.camera.Perspective.prototype */
	    {

	        updateProjectionMatrix: function() {
	            var rad = this.fov / 180 * Math.PI;
	            this.projectionMatrix.perspective(rad, this.aspect, this.near, this.far);
	        },
	        decomposeProjectionMatrix: function () {
	            var m = this.projectionMatrix._array;
	            var rad = Math.atan(1 / m[5]) * 2;
	            this.fov = rad / Math.PI * 180;
	            this.aspect = m[5] / m[0];
	            this.near = m[14] / (m[10] - 1);
	            this.far = m[14] / (m[10] + 1);
	        },
	        /**
	         * @return {qtek.camera.Perspective}
	         */
	        clone: function() {
	            var camera = Camera.prototype.clone.call(this);
	            camera.fov = this.fov;
	            camera.aspect = this.aspect;
	            camera.near = this.near;
	            camera.far = this.far;

	            return camera;
	        }
	    });

	    module.exports = Perspective;


/***/ },
/* 79 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';


	    var Node = __webpack_require__(28);
	    var Matrix4 = __webpack_require__(16);
	    var Frustum = __webpack_require__(63);
	    var Ray = __webpack_require__(26);

	    var glMatrix = __webpack_require__(15);
	    var vec3 = glMatrix.vec3;
	    var vec4 = glMatrix.vec4;

	    /**
	     * @constructor qtek.Camera
	     * @extends qtek.Node
	     */
	    var Camera = Node.extend(function () {
	        return /** @lends qtek.Camera# */ {
	            /**
	             * Camera projection matrix
	             * @type {qtek.math.Matrix4}
	             */
	            projectionMatrix: new Matrix4(),

	            /**
	             * Inverse of camera projection matrix
	             * @type {qtek.math.Matrix4}
	             */
	            invProjectionMatrix: new Matrix4(),

	            /**
	             * View matrix, equal to inverse of camera's world matrix
	             * @type {qtek.math.Matrix4}
	             */
	            viewMatrix: new Matrix4(),

	            /**
	             * Camera frustum in view space
	             * @type {qtek.math.Frustum}
	             */
	            frustum: new Frustum()
	        };
	    }, function () {
	        this.update(true);
	    },
	    /** @lends qtek.Camera.prototype */
	    {

	        update: function (force) {
	            Node.prototype.update.call(this, force);
	            Matrix4.invert(this.viewMatrix, this.worldTransform);

	            this.updateProjectionMatrix();
	            Matrix4.invert(this.invProjectionMatrix, this.projectionMatrix);

	            this.frustum.setFromProjection(this.projectionMatrix);
	        },

	        /**
	         * Set camera view matrix
	         */
	        setViewMatrix: function (viewMatrix) {
	            Matrix4.invert(this.worldTransform, viewMatrix);
	            this.decomposeWorldTransform();
	        },

	        /**
	         * Decompose camera projection matrix
	         */
	        decomposeProjectionMatrix: function () {},

	        /**
	         * Set camera projection matrix
	         */
	        setProjectionMatrix: function (projectionMatrix) {
	            Matrix4.copy(this.projectionMatrix, projectionMatrix);
	            Matrix4.invert(this.invProjectionMatrix, projectionMatrix);
	            this.decomposeProjectionMatrix();
	        },
	        /**
	         * Update projection matrix, called after update
	         */
	        updateProjectionMatrix: function () {},

	        /**
	         * Cast a picking ray from camera near plane to far plane
	         * @method
	         * @param {qtek.math.Vector2} ndc
	         * @param {qtek.math.Ray} [out]
	         * @return {qtek.math.Ray}
	         */
	        castRay: (function () {
	            var v4 = vec4.create();
	            return function (ndc, out) {
	                var ray = out !== undefined ? out : new Ray();
	                var x = ndc._array[0];
	                var y = ndc._array[1];
	                vec4.set(v4, x, y, -1, 1);
	                vec4.transformMat4(v4, v4, this.invProjectionMatrix._array);
	                vec4.transformMat4(v4, v4, this.worldTransform._array);
	                vec3.scale(ray.origin._array, v4, 1 / v4[3]);

	                vec4.set(v4, x, y, 1, 1);
	                vec4.transformMat4(v4, v4, this.invProjectionMatrix._array);
	                vec4.transformMat4(v4, v4, this.worldTransform._array);
	                vec3.scale(v4, v4, 1 / v4[3]);
	                vec3.sub(ray.direction._array, v4, ray.origin._array);

	                vec3.normalize(ray.direction._array, ray.direction._array);
	                ray.direction._dirty = true;
	                ray.origin._dirty = true;

	                return ray;
	            };
	        })()

	        /**
	         * @method
	         * @name clone
	         * @return {qtek.Camera}
	         * @memberOf qtek.Camera.prototype
	         */
	    });

	    module.exports = Camera;


/***/ },
/* 80 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';


	    var Camera = __webpack_require__(79);
	    /**
	     * @constructor qtek.camera.Orthographic
	     * @extends qtek.Camera
	     */
	    var Orthographic = Camera.extend(
	    /** @lends qtek.camera.Orthographic# */
	    {
	        /**
	         * @type {number}
	         */
	        left: -1,
	        /**
	         * @type {number}
	         */
	        right: 1,
	        /**
	         * @type {number}
	         */
	        near: -1,
	        /**
	         * @type {number}
	         */
	        far: 1,
	        /**
	         * @type {number}
	         */
	        top: 1,
	        /**
	         * @type {number}
	         */
	        bottom: -1
	    },
	    /** @lends qtek.camera.Orthographic.prototype */
	    {

	        updateProjectionMatrix: function() {
	            this.projectionMatrix.ortho(this.left, this.right, this.bottom, this.top, this.near, this.far);
	        },

	        decomposeProjectionMatrix: function () {
	            var m = this.projectionMatrix._array;
	            this.left = (-1 - m[12]) / m[0];
	            this.right = (1 - m[12]) / m[0];
	            this.top = (1 - m[13]) / m[5];
	            this.bottom = (-1 - m[13]) / m[5];
	            this.near = -(-1 - m[14]) / m[10];
	            this.far = -(1 - m[14]) / m[10];
	        },
	        /**
	         * @return {qtek.camera.Orthographic}
	         */
	        clone: function() {
	            var camera = Camera.prototype.clone.call(this);
	            camera.left = this.left;
	            camera.right = this.right;
	            camera.near = this.near;
	            camera.far = this.far;
	            camera.top = this.top;
	            camera.bottom = this.bottom;

	            return camera;
	        }
	    });

	    module.exports = Orthographic;


/***/ },
/* 81 */
/***/ function(module, exports, __webpack_require__) {

	var echarts = __webpack_require__(2);

	__webpack_require__(82);
	__webpack_require__(83);

	__webpack_require__(85);

	echarts.registerVisual(echarts.util.curry(
	    __webpack_require__(86), 'bar3D'
	));


	echarts.registerProcessor(function (ecModel, api) {
	    ecModel.eachSeriesByType('bar3D', function (seriesModel) {
	        var data = seriesModel.getData();
	        data.filterSelf(function (idx) {
	            return data.hasValue(idx);
	        });
	    });
	});

/***/ },
/* 82 */
/***/ function(module, exports, __webpack_require__) {

	var echarts = __webpack_require__(2);

	module.exports = echarts.extendSeriesModel({

	    type: 'series.bar3D',

	    dependencies: ['globe'],

	    getInitialData: function (option, ecModel) {
	        var data = new echarts.List(['x', 'y', 'z'], this);
	        data.initData(option.data);
	        return data;
	    },

	    defaultOption: {

	        coordinateSystem: 'globe',

	        globeIndex: 0,

	        zlevel: 10,

	        // Bar width and depth
	        barSize: [1, 1],

	        // Shading of globe
	        // 'color', 'lambert'
	        // TODO, 'realastic', 'toon'
	        shading: 'color',

	        // If coordinateSystem is globe, value will be mapped
	        // from minHeight to maxHeight
	        minHeight: 0,
	        maxHeight: 100,

	        itemStyle: {
	            normal: {
	                opacity: 1
	            }
	        }
	    }
	});

/***/ },
/* 83 */
/***/ function(module, exports, __webpack_require__) {

	var echarts = __webpack_require__(2);
	var graphicGL = __webpack_require__(39);
	var BarsGeometry = __webpack_require__(84);

	graphicGL.Shader.import(__webpack_require__(66));
	graphicGL.Shader.import(__webpack_require__(67));

	function getShader(shading) {
	    var shader = new graphicGL.Shader({
	        vertex: graphicGL.Shader.source('ecgl.' + shading + '.vertex'),
	        fragment: graphicGL.Shader.source('ecgl.' + shading + '.fragment')
	    });
	    shader.define('both', 'VERTEX_COLOR');
	    return shader;
	}

	module.exports = echarts.extendChartView({

	    type: 'bar3D',

	    init: function (ecModel, api) {

	        this.groupGL = new graphicGL.Node();

	        var barMesh = new graphicGL.Mesh({
	            geometry: new BarsGeometry({
	                dynamic: true
	            }),
	            ignorePicking: true
	        });
	        var barMeshTransparent = new graphicGL.Mesh({
	            geometry: new BarsGeometry({
	                dynamic: true
	            }),
	            ignorePicking: true
	        });

	        this.groupGL.add(barMesh);
	        this.groupGL.add(barMeshTransparent);

	        this._albedoMaterial = new graphicGL.Material({
	            shader: getShader('albedo')
	        });
	        this._albedoTransarentMaterial = new graphicGL.Material({
	            shader: this._albedoMaterial.shader,
	            transparent: true,
	            depthMask: false
	        });
	        this._lambertMaterial = new graphicGL.Material({
	            shader: getShader('lambert')
	        });
	        this._lambertTransarentMaterial = new graphicGL.Material({
	            shader: this._lambertMaterial.shader,
	            transparent: true,
	            depthMask: false
	        });

	        this._barMesh = barMesh;
	        this._barMeshTransparent = barMeshTransparent;
	    },

	    render: function (seriesModel, ecModel, api) {
	        this.groupGL.add(this._barMesh);
	        this.groupGL.add(this._barMeshTransparent);

	        var coordSys = seriesModel.coordinateSystem;
	        if (coordSys.type === 'globe') {
	            coordSys.viewGL.add(this.groupGL);

	            this._renderOnGlobe(seriesModel, api);
	        }
	    },

	    _renderOnGlobe: function (seriesModel, api) {
	        var data = seriesModel.getData();
	        var shading = seriesModel.get('shading');
	        var enableNormal = false;
	        var self = this;
	        if (shading === 'color') {
	            this._barMesh.material = this._albedoMaterial;
	            this._barMeshTransparent.material = this._albedoTransarentMaterial;
	        }
	        else if (shading === 'lambert') {
	            enableNormal = true;
	            this._barMesh.material = this._lambertMaterial;
	            this._barMeshTransparent.material = this._lambertTransarentMaterial;
	        }
	        else {
	            console.warn('Unkonw shading ' + shading);
	            this._barMesh.material = this._albedoMaterial;
	            this._barMeshTransparent.material = this._albedoTransarentMaterial;
	        }

	        this._barMesh.geometry.resetOffset();
	        this._barMeshTransparent.geometry.resetOffset();

	        var transparentBarCount = 0;
	        var opaqueBarCount = 0;

	        var colorArr = [];
	        var vertexColors = new Float32Array(data.count() * 4);
	        var colorOffset = 0;
	        // Seperate opaque and transparent bars.
	        data.each(function (idx) {
	            var color = data.getItemVisual(idx, 'color');

	            var opacity = data.getItemVisual(idx, 'opacity');
	            if (opacity == null) {
	                opacity = 1;
	            }

	            echarts.color.parse(color, colorArr);
	            vertexColors[colorOffset++] = colorArr[0] / 255;
	            vertexColors[colorOffset++] = colorArr[1] / 255;
	            vertexColors[colorOffset++] = colorArr[2] / 255;
	            vertexColors[colorOffset++] = colorArr[3] * opacity;

	            if (colorArr[3] < 0.99) {
	                if (colorArr[3] > 0) {
	                    transparentBarCount++;
	                }
	            }
	            else {
	                opaqueBarCount++;
	            }
	        });
	        this._barMesh.geometry.setBarCount(opaqueBarCount, enableNormal);
	        this._barMeshTransparent.geometry.setBarCount(transparentBarCount, enableNormal);

	        var barSize = seriesModel.get('barSize');
	        if (!echarts.util.isArray(barSize)) {
	            barSize = [barSize, barSize];
	        }
	        data.each(function (idx) {
	            var layout = data.getItemLayout(idx);
	            var start = layout[0];
	            var end = layout[1];
	            var orient = graphicGL.Vector3.UP._array;

	            var idx4 = idx * 4;
	            colorArr[0] = vertexColors[idx4++];
	            colorArr[1] = vertexColors[idx4++];
	            colorArr[2] = vertexColors[idx4++];
	            colorArr[3] = vertexColors[idx4++];
	            if (colorArr[3] < 0.99) {
	                if (colorArr[3] > 0) {
	                    self._barMeshTransparent.geometry.addBar(start, end, orient, barSize, colorArr);
	                }
	            }
	            else {
	                self._barMesh.geometry.addBar(start, end, orient, barSize, colorArr);
	            }
	        });

	        this._barMesh.geometry.dirty();
	        this._barMeshTransparent.geometry.dirty();
	    },

	    remove: function () {
	        this.groupGL.removeAll();
	    },

	    dispose: function () {
	        this.groupGL.removeAll();
	    }
	});

/***/ },
/* 84 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * Geometry collecting bars data
	 *
	 * @module echarts-gl/chart/bars/BarsGeometry
	 * @author Yi Shen(http://github.com/pissang)
	 */

	var StaticGeometry = __webpack_require__(32);

	var glMatrix = __webpack_require__(15);
	var vec3 = glMatrix.vec3;

	/**
	 * @constructor
	 * @alias module:echarts-gl/chart/bars/BarsGeometry
	 * @extends qtek.StaticGeometry
	 */
	var BarsGeometry = StaticGeometry.extend(function () {
	    return {

	        attributes: {
	            position: new StaticGeometry.Attribute('position', 'float', 3, 'POSITION'),
	            normal: new StaticGeometry.Attribute('normal', 'float', 3, 'NORMAL'),
	            color: new StaticGeometry.Attribute('color', 'float', 4, 'COLOR')
	        },
	        _vertexOffset: 0,
	        _faceOffset: 0
	    };
	},
	/** @lends module:echarts-gl/chart/bars/BarsGeometry.prototype */
	{

	    resetOffset: function () {
	        this._vertexOffset = 0;
	        this._faceOffset = 0;
	    },

	    setBarCount: function (barCount, enableNormal) {
	        var vertexCount = this.getBarVertexCount(enableNormal) * barCount;
	        var faceCount = this.getBarFaceCount(enableNormal) * barCount;

	        if (this.vertexCount !== vertexCount) {
	            this.attributes.position.init(vertexCount);
	            if (enableNormal) {
	                this.attributes.normal.init(vertexCount);
	            }
	            else {
	                this.attributes.normal.value = null;
	            }
	            this.attributes.color.init(vertexCount);
	        }

	        if (this.faceCount !== faceCount) {
	            this.faces = vertexCount > 0xffff ? new Uint32Array(faceCount * 3) : new Uint16Array(faceCount * 3);
	        }

	        this._enableNormal = enableNormal;
	    },

	    getBarVertexCount: function (enableNormal) {
	        return enableNormal ? 24 : 8;
	    },

	    getBarFaceCount: function () {
	        return 12;
	    },

	    /**
	     * Add a bar
	     * @param {Array.<number>} start
	     * @param {Array.<number>} end
	     * @param {Array.<number>} orient  right direction
	     * @param {Array.<number>} size size on x and z
	     * @param {Array.<number>} color
	     */
	    addBar: (function () {
	        var v3Create = vec3.create;
	        var v3ScaleAndAdd = vec3.scaleAndAdd;

	        var px = v3Create();
	        var py = v3Create();
	        var pz = v3Create();
	        var nx = v3Create();
	        var ny = v3Create();
	        var nz = v3Create();

	        var pts = [];
	        var normals = [];
	        for (var i = 0; i < 8; i++) {
	            pts[i] = v3Create();
	        }

	        var cubeFaces4 = [
	            // PX
	            [0, 1, 5, 4],
	            // NX
	            [2, 3, 7, 6],
	            // PY
	            [4, 5, 6, 7],
	            // NY
	            [3, 2, 1, 0],
	            // PZ
	            [0, 4, 7, 3],
	            // NZ
	            [1, 2, 6, 5]
	        ];
	        var face4To3 = [
	            0, 1, 2, 0, 2, 3
	        ];
	        var cubeFaces3 = [];
	        for (var i = 0; i < cubeFaces4.length; i++) {
	            var face4 = cubeFaces4[i];
	            for (var j = 0; j < 2; j++) {
	                var face = [];
	                for (var k = 0; k < 3; k++) {
	                    face.push(face4[face4To3[j * 3 + k]]);
	                }
	                cubeFaces3.push(face);
	            }
	        }
	        return function (start, end, orient, size, color) {
	            vec3.sub(py, end, start);
	            vec3.normalize(py, py);
	            // x * y => z
	            vec3.cross(pz, orient, py);
	            vec3.normalize(pz, pz);
	            // y * z => x
	            vec3.cross(px, py, pz);
	            vec3.normalize(pz, pz);

	            vec3.negate(nx, px);
	            vec3.negate(ny, py);
	            vec3.negate(nz, pz);

	            v3ScaleAndAdd(pts[0], start, px, size[0]);
	            v3ScaleAndAdd(pts[0], pts[0], pz, size[1]);
	            v3ScaleAndAdd(pts[1], start, px, size[0]);
	            v3ScaleAndAdd(pts[1], pts[1], nz, size[1]);
	            v3ScaleAndAdd(pts[2], start, nx, size[0]);
	            v3ScaleAndAdd(pts[2], pts[2], nz, size[1]);
	            v3ScaleAndAdd(pts[3], start, nx, size[0]);
	            v3ScaleAndAdd(pts[3], pts[3], pz, size[1]);

	            v3ScaleAndAdd(pts[4], end, px, size[0]);
	            v3ScaleAndAdd(pts[4], pts[4], pz, size[1]);
	            v3ScaleAndAdd(pts[5], end, px, size[0]);
	            v3ScaleAndAdd(pts[5], pts[5], nz, size[1]);
	            v3ScaleAndAdd(pts[6], end, nx, size[0]);
	            v3ScaleAndAdd(pts[6], pts[6], nz, size[1]);
	            v3ScaleAndAdd(pts[7], end, nx, size[0]);
	            v3ScaleAndAdd(pts[7], pts[7], pz, size[1]);

	            var attributes = this.attributes;
	            if (this._enableNormal) {
	                normals[0] = px;
	                normals[1] = nx;
	                normals[2] = py;
	                normals[3] = ny;
	                normals[4] = pz;
	                normals[5] = nz;

	                var vertexOffset = this._vertexOffset;
	                for (var i = 0; i < cubeFaces4.length; i++) {
	                    var idx3 = this._faceOffset * 3;
	                    for (var k = 0; k < 6; k++) {
	                        this.faces[idx3++] = vertexOffset + face4To3[k];
	                    }
	                    vertexOffset += 4;
	                    this._faceOffset += 2;
	                }

	                for (var i = 0; i < cubeFaces4.length; i++) {
	                    var normal = normals[i];
	                    for (var k = 0; k < 4; k++) {
	                        var idx = cubeFaces4[i][k];
	                        attributes.position.set(this._vertexOffset, pts[idx]);
	                        attributes.normal.set(this._vertexOffset, normal);
	                        attributes.color.set(this._vertexOffset++, color);
	                    }
	                }
	            }
	            else {
	                for (var i = 0; i < cubeFaces3.length; i++) {
	                    var idx3 = this._faceOffset * 3;
	                    for (var k = 0; k < 3; k++) {
	                        this.faces[idx3 + k] = cubeFaces3[i][k] + this._vertexOffset;
	                    }
	                    this._faceOffset++;
	                }

	                for (var i = 0; i < pts.length; i++) {
	                    attributes.position.set(this._vertexOffset, pts[i]);
	                    attributes.color.set(this._vertexOffset++, color);
	                }
	            }
	        };
	    })()
	});

	module.exports = BarsGeometry;

/***/ },
/* 85 */
/***/ function(module, exports, __webpack_require__) {

	var echarts = __webpack_require__(2);

	function globeLayout(seriesModel, coordSys) {
	    var data = seriesModel.getData();
	    var extent = data.getDataExtent('z', true);
	    var heightExtent = [seriesModel.get('minHeight'), seriesModel.get('maxHeight')];
	    var isZeroExtent = Math.abs(extent[1] - extent[0]) < 1e-10;
	    data.each(['x', 'y', 'z'], function (lng, lat, val, idx) {
	        var height = isZeroExtent ? heightExtent[1] : echarts.number.linearMap(val, extent, heightExtent);
	        var start = coordSys.dataToPoint([lng, lat, 0]);
	        var end = coordSys.dataToPoint([lng, lat, height]);
	        data.setItemLayout(idx, [start, end]);
	    });
	}
	echarts.registerLayout(function (ecModel, api) {
	    ecModel.eachSeriesByType('bar3D', function (seriesModel) {
	        var coordSys = seriesModel.coordinateSystem;
	        if (coordSys.type === 'globe') {
	            globeLayout(seriesModel, coordSys);
	        }
	    });
	});

/***/ },
/* 86 */
/***/ function(module, exports) {

	module.exports = function (seriesType, ecModel, api) {
	    ecModel.eachSeriesByType(seriesType, function (seriesModel) {
	        var data = seriesModel.getData();
	        var opacityAccessPath = seriesModel.visualColorAccessPath.split('.');
	        opacityAccessPath[opacityAccessPath.length - 1] ='opacity';

	        var opacity = seriesModel.get(opacityAccessPath);

	        data.setVisual('opacity', opacity == null ? 1 : opacity);

	        if (data.hasItemOption) {
	            data.each(function (idx) {
	                var itemModel = data.getItemModel(idx);
	                var opacity = itemModel.get(opacityAccessPath);
	                if (opacity != null) {
	                    data.setItemVisual(idx, opacity);
	                }
	            });
	        }
	    });
	};

/***/ },
/* 87 */
/***/ function(module, exports) {

	

/***/ },
/* 88 */
/***/ function(module, exports, __webpack_require__) {

	var echarts = __webpack_require__(2);

	__webpack_require__(89);

	__webpack_require__(90);
	__webpack_require__(93);

	echarts.registerVisual(echarts.util.curry(
	    __webpack_require__(86), 'lines3D'
	));


/***/ },
/* 89 */
/***/ function(module, exports, __webpack_require__) {

	var echarts = __webpack_require__(2);
	var glmatrix = __webpack_require__(15);
	var vec3 = glmatrix.vec3;

	function layoutGlobe(seriesModel, coordSys) {
	    var data = seriesModel.getData();
	    var isPolyline = seriesModel.get('polyline');

	    var normal = vec3.create();
	    var tangent = vec3.create();
	    var bitangent = vec3.create();
	    var halfVector = vec3.create();

	    data.setLayout('lineType', isPolyline ? 'polyline' : 'cubicBezier');

	    data.each(function (idx) {
	        var itemModel = data.getItemModel(idx);
	        var coords = (itemModel.option instanceof Array) ?
	            itemModel.option : itemModel.getShallow('coords', true);

	        if (!(coords instanceof Array && coords.length > 0 && coords[0] instanceof Array)) {
	            throw new Error('Invalid coords ' + JSON.stringify(coords) + '. Lines must have 2d coords array in data item.');
	        }

	        var pts = [];
	        if (isPolyline) {

	        }
	        else {
	            var p0 = pts[0] = vec3.create();
	            var p1 = pts[1] = vec3.create();
	            var p2 = pts[2] = vec3.create();
	            var p3 = pts[3] = vec3.create();
	            coordSys.dataToPoint(coords[0], p0);
	            coordSys.dataToPoint(coords[1], p3);
	            // Get p1
	            vec3.normalize(normal, p0);
	            // TODO p0-p3 is parallel with normal
	            vec3.sub(tangent, p3, p0);
	            vec3.normalize(tangent, tangent);
	            vec3.cross(bitangent, tangent, normal);
	            vec3.normalize(bitangent, bitangent);
	            vec3.cross(tangent, normal, bitangent);
	            // p1 is half vector of p0 and tangent on p0
	            vec3.add(p1, normal, tangent);
	            vec3.normalize(p1, p1);

	            // Get p2
	            vec3.normalize(normal, p3);
	            vec3.sub(tangent, p0, p3);
	            vec3.normalize(tangent, tangent);
	            vec3.cross(bitangent, tangent, normal);
	            vec3.normalize(bitangent, bitangent);
	            vec3.cross(tangent, normal, bitangent);
	            // p2 is half vector of p3 and tangent on p3
	            vec3.add(p2, normal, tangent);
	            vec3.normalize(p2, p2);

	            // Project distance of p0 on halfVector
	            vec3.add(halfVector, p0, p3);
	            vec3.normalize(halfVector, halfVector);
	            var projDist = vec3.dot(p0, halfVector);
	            // Angle of halfVector and p1
	            var cosTheta = vec3.dot(halfVector, p1);
	            var len = (coordSys.radius - projDist) / cosTheta * 2;

	            vec3.scaleAndAdd(p1, p0, p1, len);
	            vec3.scaleAndAdd(p2, p3, p2, len);
	        }

	        data.setItemLayout(idx, pts);
	    });
	}

	echarts.registerLayout(function (ecModel, api) {
	    ecModel.eachSeriesByType('lines3D', function (seriesModel) {
	        var coordSys = seriesModel.coordinateSystem;
	        if (coordSys.type === 'globe') {
	            layoutGlobe(seriesModel, coordSys);
	        }
	    });
	});

/***/ },
/* 90 */
/***/ function(module, exports, __webpack_require__) {

	var echarts = __webpack_require__(2);
	var graphicGL = __webpack_require__(39);
	var LinesGeometry = __webpack_require__(91);

	graphicGL.Shader.import(__webpack_require__(92));

	module.exports = echarts.extendChartView({

	    type: 'lines3D',

	    init: function (ecModel, api) {
	        this.groupGL = new graphicGL.Node();

	        // TODO Windows chrome not support lineWidth > 1
	        this._linesMesh = new graphicGL.Mesh({
	            material: new graphicGL.Material({
	                shader: new graphicGL.Shader({
	                    vertex: graphicGL.Shader.source('ecgl.lines.vertex'),
	                    fragment: graphicGL.Shader.source('ecgl.lines.fragment')
	                }),
	                transparent: true
	            }),
	            mode: graphicGL.Mesh.LINES,
	            geometry: new LinesGeometry({
	                dynamic: true
	            }),
	            ignorePicking: true
	        });
	    },

	    render: function (seriesModel, ecModel, api) {

	        this.groupGL.add(this._linesMesh);

	        var coordSys = seriesModel.coordinateSystem;
	        var data = seriesModel.getData();

	        if (coordSys.type === 'globe') {
	            var viewGL = coordSys.viewGL;
	            viewGL.add(this.groupGL);

	            if (data.getLayout('lineType') === 'cubicBezier') {
	                this._generateBezierCurvesOnGlobe(seriesModel);
	            }
	        }

	        this._linesMesh.material.blend = seriesModel.get('blendMode') === 'lighter'
	            ? graphicGL.additiveBlend : null;
	    },

	    _generateBezierCurvesOnGlobe: function (seriesModel) {
	        var data = seriesModel.getData();
	        var coordSys = seriesModel.coordinateSystem;
	        var geometry = this._linesMesh.geometry;
	        geometry.segmentScale = coordSys.radius / 20;

	        var nVertex = 0;
	        data.each(function (idx) {
	            var pts = data.getItemLayout(idx);
	            nVertex += geometry.getCubicCurveVertexCount(pts[0], pts[1], pts[2], pts[3]);
	        });
	        geometry.setVertexCount(nVertex);
	        geometry.resetOffset();

	        var colorArr = [];
	        data.each(function (idx) {
	            var pts = data.getItemLayout(idx);
	            var color = data.getItemVisual(idx, 'color');
	            var opacity = data.getItemVisual(idx, 'opacity');
	            if (opacity == null) {
	                opacity = 1;
	            }

	            colorArr = echarts.color.parse(color, colorArr);
	            colorArr[0] /= 255; colorArr[1] /= 255; colorArr[2] /= 255;
	            colorArr[3] *= opacity;

	            geometry.addCubicCurve(pts[0], pts[1], pts[2], pts[3], colorArr);
	        });

	        geometry.dirty();
	    },

	    remove: function () {
	        this.groupGL.removeAll();
	    },

	    dispose: function () {
	        this.groupGL.removeAll();
	    }
	});

/***/ },
/* 91 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * Geometry collecting straight line, cubic curve data
	 * @module echarts-gl/chart/lines3D/LinesGeometry
	 * @author Yi Shen(http://github.com/pissang)
	 */

	var StaticGeometry = __webpack_require__(32);
	var vec3 = __webpack_require__(15).vec3;

	// var CURVE_RECURSION_LIMIT = 8;
	// var CURVE_COLLINEAR_EPSILON = 40;

	/**
	 * @constructor
	 * @alias module:echarts-gl/chart/lines3D/LinesGeometry
	 * @extends qtek.StaticGeometry
	 */

	var LinesGeometry = StaticGeometry.extend(function () {
	    return {

	        segmentScale: 1,

	        attributes: {
	            position: new StaticGeometry.Attribute('position', 'float', 3, 'POSITION'),
	            color: new StaticGeometry.Attribute('color', 'float', 4, 'COLOR')
	        }
	    };
	},
	/** @lends module: echarts-gl/chart/lines3D/LinesGeometry.prototype */
	{

	    /**
	     * Reset offset
	     */
	    resetOffset: function () {
	        this._offset = 0;
	    },

	    /**
	     * @param {number} nVertex
	     */
	    setVertexCount: function (nVertex) {
	        if (this.vertexCount !== nVertex) {
	            this.attributes.position.init(nVertex);
	            this.attributes.color.init(nVertex);

	            this._offset = 0;
	        }
	    },

	    /**
	     * Get vertex count of cubic curve
	     * @param {Array.<number>} p0
	     * @param {Array.<number>} p1
	     * @param {Array.<number>} p2
	     * @param {Array.<number>} p3
	     * @return number
	     */
	    getCubicCurveVertexCount: function (p0, p1, p2, p3) {
	        var len = vec3.dist(p0, p1) + vec3.dist(p2, p1) + vec3.dist(p3, p2);
	        var step = 1 / (len + 1) * this.segmentScale;
	        return Math.ceil(1 / step) * 2 + 1;
	    },
	    /**
	     * Add a cubic curve
	     * @param {Array.<number>} p0
	     * @param {Array.<number>} p1
	     * @param {Array.<number>} p2
	     * @param {Array.<number>} p3
	     * @param {Array.<number>} color
	     */
	    addCubicCurve: function (p0, p1, p2, p3, color) {
	        // incremental interpolation
	        // http://antigrain.com/research/bezier_interpolation/index.html#PAGE_BEZIER_INTERPOLATION
	        var x0 = p0[0], y0 = p0[1], z0 = p0[2];
	        var x1 = p1[0], y1 = p1[1], z1 = p1[2];
	        var x2 = p2[0], y2 = p2[1], z2 = p2[2];
	        var x3 = p3[0], y3 = p3[1], z3 = p3[2];

	        var len = vec3.dist(p0, p1) + vec3.dist(p2, p1) + vec3.dist(p3, p2);
	        var step = 1 / (len + 1) * this.segmentScale;

	        var step2 = step * step;
	        var step3 = step2 * step;

	        var pre1 = 3.0 * step;
	        var pre2 = 3.0 * step2;
	        var pre4 = 6.0 * step2;
	        var pre5 = 6.0 * step3;

	        var tmp1x = x0 - x1 * 2.0 + x2;
	        var tmp1y = y0 - y1 * 2.0 + y2;
	        var tmp1z = z0 - z1 * 2.0 + z2;

	        var tmp2x = (x1 - x2) * 3.0 - x0 + x3;
	        var tmp2y = (y1 - y2) * 3.0 - y0 + y3;
	        var tmp2z = (z1 - z2) * 3.0 - z0 + z3;

	        var fx = x0;
	        var fy = y0;
	        var fz = z0;

	        var dfx = (x1 - x0) * pre1 + tmp1x * pre2 + tmp2x * step3;
	        var dfy = (y1 - y0) * pre1 + tmp1y * pre2 + tmp2y * step3;
	        var dfz = (z1 - z0) * pre1 + tmp1z * pre2 + tmp2z * step3;

	        var ddfx = tmp1x * pre4 + tmp2x * pre5;
	        var ddfy = tmp1y * pre4 + tmp2y * pre5;
	        var ddfz = tmp1z * pre4 + tmp2z * pre5;

	        var dddfx = tmp2x * pre5;
	        var dddfy = tmp2y * pre5;
	        var dddfz = tmp2z * pre5;

	        var positionAttr = this.attributes.position;
	        var colorAttr = this.attributes.color;
	        var firstSeg = true;
	        var t = 0;
	        var posTmp = [];
	        while (t < 1 + step) {
	            if (!firstSeg) {
	                positionAttr.copy(this._offset, this._offset - 1);
	                colorAttr.copy(this._offset, this._offset - 1);
	                this._offset ++;
	            }

	            firstSeg = false;

	            colorAttr.set(this._offset, color);
	            posTmp[0] = fx; posTmp[1] = fy; posTmp[2] = fz;
	            positionAttr.set(this._offset, posTmp);
	            this._offset++;

	            fx += dfx; fy += dfy; fz += dfz;
	            dfx += ddfx; dfy += ddfy; dfz += ddfz;
	            ddfx += dddfx; ddfy += dddfy; ddfz += dddfz;
	            t += step;
	        }
	    }
	});

	module.exports = LinesGeometry;

/***/ },
/* 92 */
/***/ function(module, exports) {

	module.exports = "@export ecgl.lines.vertex\n\nuniform mat4 worldViewProjection : WORLDVIEWPROJECTION;\n\nattribute vec3 position: POSITION;\nattribute vec4 a_Color : COLOR;\nvarying vec4 v_Color;\n\nvoid main()\n{\n    gl_Position = worldViewProjection * vec4(position, 1.0);\n    v_Color = a_Color;\n}\n\n@end\n\n@export ecgl.lines.fragment\n\nuniform vec3 color : [1.0, 1.0, 1.0];\nuniform float alpha : 1.0;\n\nvarying vec4 v_Color;\n\nvoid main()\n{\n    gl_FragColor = vec4(color, alpha) * v_Color;\n}\n@end"

/***/ },
/* 93 */
/***/ function(module, exports, __webpack_require__) {

	var echarts = __webpack_require__(2);

	echarts.extendSeriesModel({

	    type: 'series.lines3D',

	    dependencies: ['globe'],

	    visualColorAccessPath: 'lineStyle.normal.color',

	    getInitialData: function (option, ecModel) {
	        var lineData = new echarts.List(['value'], this);
	        lineData.hasItemOption = false;
	        lineData.initData(option.data, [], function (dataItem, dimName, dataIndex, dimIndex) {
	            // dataItem is simply coords
	            if (dataItem instanceof Array) {
	                return NaN;
	            }
	            else {
	                lineData.hasItemOption = true;
	                var value = dataItem.value;
	                if (value != null) {
	                    return value instanceof Array ? value[dimIndex] : value;
	                }
	            }
	        });

	        return lineData;
	    },

	    defaultOption: {

	        coordinateSystem: 'globe',

	        globeIndex: 0,

	        zlevel: 10,

	        polyline: false,

	        effect: {
	            show: false,
	            period: 4
	        },

	        // Support source-over, lighter
	        blendMode: 'source-over',

	        lineStyle: {
	            normal: {
	                // color
	                // opacity
	            }
	        }
	    }
	});

/***/ },
/* 94 */
/***/ function(module, exports, __webpack_require__) {

	var echarts = __webpack_require__(2);

	__webpack_require__(95);
	__webpack_require__(96);

	echarts.registerVisual(echarts.util.curry(
	    __webpack_require__(99), 'scatterGL', 'circle', null
	));

	echarts.registerVisual(echarts.util.curry(
	    __webpack_require__(86), 'scatterGL'
	));

	echarts.registerLayout(function (ecModel, api) {
	    ecModel.eachSeriesByType('scatterGL', function (seriesModel) {
	        var data = seriesModel.getData();
	        var coordSys = seriesModel.coordinateSystem;

	        if (coordSys) {
	            var dims = coordSys.dimensions;
	            var points = new Float32Array(data.count() * 2);
	            if (dims.length === 1) {
	                data.each(dims[0], function (x, idx) {
	                    var pt = coordSys.dataToPoint(x);
	                    points[idx * 2] = pt[0];
	                    points[idx * 2 + 1] = pt[1];
	                });
	            }
	            else if (dims.length === 2) {
	                var item = [];
	                data.each(dims, function (x, y, idx) {
	                    item[0] = x;
	                    item[1] = y;

	                    var pt = coordSys.dataToPoint(item);
	                    points[idx * 2] = pt[0];
	                    points[idx * 2 + 1] = pt[1];
	                });
	            }

	            data.setLayout('points', points);
	        }
	    });
	});

/***/ },
/* 95 */
/***/ function(module, exports, __webpack_require__) {

	var echarts = __webpack_require__(2);

	echarts.extendSeriesModel({

	    type: 'series.scatterGL',

	    dependencies: ['grid', 'polar', 'geo', 'singleAxis'],

	    getInitialData: function () {
	        return echarts.helper.createList(this);
	    },

	    defaultOption: {
	        coordinateSystem: 'cartesian2d',
	        zlevel: 10,

	        // Cartesian coordinate system
	        // xAxisIndex: 0,
	        // yAxisIndex: 0,

	        // Polar coordinate system
	        // polarIndex: 0,

	        // Geo coordinate system
	        // geoIndex: 0,

	        symbol: 'circle',
	        symbolSize: 10,          // 图形大小，半宽（半径）参数，当图形为方向或菱形则总宽度为symbolSize * 2
	        // symbolRotate: null,  // 图形旋转控制

	        // Support source-over, lighter
	        blendMode: 'source-over',

	        itemStyle: {
	            normal: {
	                opacity: 0.8
	                // color: 各异
	            }
	        }

	    }
	});

/***/ },
/* 96 */
/***/ function(module, exports, __webpack_require__) {

	var echarts = __webpack_require__(2);
	var graphicGL = __webpack_require__(39);
	var viewGL = __webpack_require__(77);
	var spriteUtil = __webpack_require__(97);

	graphicGL.Shader.import(__webpack_require__(98));

	echarts.extendChartView({

	    type: 'scatterGL',

	    init: function (ecModel, api) {

	        this.groupGL = new graphicGL.Node();
	        this.viewGL = new viewGL('orthographic');

	        this.viewGL.add(this.groupGL);

	        var mesh = new graphicGL.Mesh({
	            material: new graphicGL.Material({
	                shader: new graphicGL.Shader({
	                    vertex: graphicGL.Shader.source('ecgl.points.vertex'),
	                    fragment: graphicGL.Shader.source('ecgl.points.fragment')
	                }),
	                transparent: true,
	                depthMask: false
	            }),
	            geometry: new graphicGL.Geometry({
	                dynamic: true
	            }),
	            mode: graphicGL.Mesh.POINTS
	        });
	        mesh.geometry.createAttribute('color', 'float', 4, 'COLOR');
	        mesh.geometry.createAttribute('size', 'float', 1);
	        mesh.material.shader.enableTexture('sprite');

	        this.groupGL.add(mesh);

	        this._pointsMesh = mesh;

	        this._symbolTexture = new graphicGL.Texture2D({
	            image: document.createElement('canvas')
	        });
	        mesh.material.set('sprite', this._symbolTexture);
	    },

	    render: function (seriesModel, ecModel, api) {
	        this.groupGL.add(this._pointsMesh);

	        this._updateCamera(api.getWidth(), api.getHeight());

	        var data = seriesModel.getData();
	        var geometry = this._pointsMesh.geometry;

	        var hasItemColor = false;
	        var hasItemOpacity = false;
	        for (var i = 0; i < data.count(); i++) {
	            if (!hasItemColor && data.getItemVisual(i, 'color', true) != null) {
	                hasItemColor = true;
	            }
	            if (!hasItemColor && data.getItemVisual(i, 'opacity', true) != null) {
	                hasItemOpacity = true;
	            }
	        }
	        var vertexColor = hasItemColor || hasItemOpacity;
	        this._pointsMesh.material.shader[vertexColor ? 'define' : 'unDefine']('both', 'VERTEX_COLOR');

	        this._pointsMesh.material.blend = seriesModel.get('blendMode') === 'lighter'
	            ? graphicGL.additiveBlend : null;

	        var symbolInfo = this._getSymbolInfo(data);
	        var dpr = api.getZr().painter.dpr;
	        // TODO arc is not so accurate in chrome, scale it a bit ?.
	        symbolInfo.maxSize *= dpr;
	        var symbolSize = [];
	        if (symbolInfo.aspect > 1) {
	            symbolSize[0] = symbolInfo.maxSize;
	            symbolSize[1] = symbolInfo.maxSize / symbolInfo.aspect;
	        }
	        else {
	            symbolSize[1] = symbolInfo.maxSize;
	            symbolSize[0] = symbolInfo.maxSize * symbolInfo.aspect;
	        }

	        // TODO image symbol
	        // TODO, shadowOffsetX, shadowOffsetY may not work well.
	        var itemStyle = seriesModel.getModel('itemStyle.normal').getItemStyle();
	        var margin = spriteUtil.getMarginByStyle(itemStyle);
	        if (hasItemColor) {
	            itemStyle.fill = '#ffffff';
	            if (margin.right || margin.left || margin.bottom || margin.top) {
	                if (true) {
	                    console.warn('shadowColor, borderColor will be ignored if data has different colors');
	                }
	                ['stroke', 'shadowColor'].forEach(function (key) {
	                    itemStyle[key] = '#ffffff';
	                });
	            }
	        }
	        spriteUtil.createSymbolSprite(symbolInfo.type, symbolSize, itemStyle, this._symbolTexture.image);
	        document.body.appendChild(this._symbolTexture.image);

	        var diffX = (margin.right - margin.left) / 2;
	        var diffY = (margin.bottom - margin.top) / 2;
	        var diffSize = Math.max(margin.right + margin.left, margin.top + margin.bottom);

	        var points = data.getLayout('points');
	        var attributes = geometry.attributes;
	        attributes.position.init(data.count());
	        attributes.size.init(data.count());
	        if (vertexColor) {
	            attributes.color.init(data.count());
	        }
	        var positionArr = attributes.position.value;
	        var colorArr = attributes.color.value;

	        var rgbaArr = [];
	        for (var i = 0; i < data.count(); i++) {
	            var i4 = i * 4;
	            var i3 = i * 3;
	            var i2 = i * 2;
	            positionArr[i3] = points[i2] + diffX;
	            positionArr[i3 + 1] = points[i2 + 1] + diffY;
	            positionArr[i3 + 2] = -10;

	            if (vertexColor) {
	                if (!hasItemColor && hasItemOpacity) {
	                    colorArr[i4++] = colorArr[i4++] = colorArr[i4++] = 1;
	                    colorArr[i4] = data.getItemVisual(i, 'opacity');
	                }
	                else {
	                    var color = data.getItemVisual(i, 'color');
	                    var opacity = data.getItemVisual(i, 'opacity');
	                    echarts.color.parse(color, rgbaArr);
	                    rgbaArr[0] /= 255; rgbaArr[1] /= 255; rgbaArr[2] /= 255;
	                    rgbaArr[3] *= opacity;
	                    attributes.color.set(i, rgbaArr);
	                }
	            }

	            var symbolSize = data.getItemVisual(i, 'symbolSize');

	            attributes.size.value[i] = ((symbolSize instanceof Array
	                ? Math.max(symbolSize[0], symbolSize[1]) : symbolSize) + diffSize) * dpr;
	        }

	        geometry.dirty();
	    },

	    updateLayout: function (seriesModel, ecModel, api) {
	        var data = seriesModel.getData();
	        var positionArr = this._pointsMesh.geometry.attributes.position.value;
	        var points = data.getLayout('points');
	        for (var i = 0; i < points.length / 2; i++) {
	            var i3 = i * 3;
	            var i2 = i * 2;
	            positionArr[i3] = points[i2];
	            positionArr[i3 + 1] = points[i2 + 1];
	        }
	        this._pointsMesh.geometry.dirty();
	    },

	    _getSymbolInfo: function (data) {
	        var symbolAspect = 1;
	        var differentSymbolAspect = false;
	        var symbolType = data.getItemVisual(0, 'symbol') || 'circle';
	        var differentSymbolType = false;
	        var maxSymbolSize = 0;

	        data.each(function (idx) {
	            var symbolSize = data.getItemVisual(idx, 'symbolSize');
	            var currentSymbolType = data.getItemVisual(idx, 'symbol');
	            var currentSymbolAspect;
	            if (!(symbolSize instanceof Array)) {
	                currentSymbolAspect = 1;
	                maxSymbolSize = Math.max(symbolSize, maxSymbolSize);
	            }
	            else {
	                currentSymbolAspect = symbolSize[0] / symbolSize[1];
	                maxSymbolSize = Math.max(Math.max(symbolSize[0], symbolSize[1]), maxSymbolSize);
	            }
	            if (true) {
	                if (Math.abs(currentSymbolAspect - symbolAspect) > 0.05) {
	                    differentSymbolAspect = true;
	                }
	                if (currentSymbolType !== symbolType) {
	                    differentSymbolType = true;
	                }
	            }
	            symbolType = currentSymbolType;
	            symbolAspect = currentSymbolAspect;
	        });

	        if (true) {
	            if (differentSymbolAspect) {
	                console.warn('Different symbol width / height ratio will be ignored.');
	            }
	            if (differentSymbolType) {
	                console.warn('Different symbol type will be ignored.');
	            }
	        }

	        return {
	            maxSize: maxSymbolSize,
	            type: symbolType,
	            aspect: symbolAspect
	        };
	    },

	    _updateCamera: function (width, height) {
	        this.viewGL.setViewport(0, 0, width, height);
	        var camera = this.viewGL.camera;
	        camera.left = camera.top = 0;
	        camera.bottom = height;
	        camera.right = width;
	        camera.near = 0;
	        camera.far = 100;
	    },

	    dispose: function () {
	        this.groupGL.removeAll();
	    },

	    remove: function () {
	        this.groupGL.removeAll();
	    }
	});

/***/ },
/* 97 */
/***/ function(module, exports, __webpack_require__) {

	var echarts = __webpack_require__(2);

	function makeSprite(size, canvas, draw) {
	    // http://simonsarris.com/blog/346-how-you-clear-your-canvas-matters
	    // http://jsperf.com/canvasclear
	    // Set width and height is fast
	    // And use the exist canvas if possible
	    // http://jsperf.com/create-canvas-vs-set-width-height/2
	    var canvas = canvas || document.createElement('canvas');
	    canvas.width = size;
	    canvas.height = size;
	    var ctx = canvas.getContext('2d');

	    draw && draw(ctx);

	    return canvas;
	}

	var spriteUtil = {

	    getMarginByStyle: function (style) {
	        var lineWidth = 0;
	        if (style.stroke && style.stroke !== 'none') {
	            lineWidth = style.lineWidth == null ? 1 : style.lineWidth;
	        }
	        var shadowBlurSize = style.shadowBlur || 0;
	        var shadowOffsetX = style.shadowOffsetX || 0;
	        var shadowOffsetY = style.shadowOffsetY || 0;

	        var margin = {};
	        margin.left = Math.max(lineWidth / 2, -shadowOffsetX + shadowBlurSize);
	        margin.right = Math.max(lineWidth / 2, shadowOffsetX + shadowBlurSize);
	        margin.top = Math.max(lineWidth / 2, -shadowOffsetY + shadowBlurSize);
	        margin.bottom = Math.max(lineWidth / 2, shadowOffsetY + shadowBlurSize);

	        return margin;
	    },
	    /**
	     * @param {string} symbol
	     * @param {number | Array.<number>} symbolSize
	     */
	    createSymbolSprite: function (symbol, symbolSize, style, canvas) {
	        if (!echarts.util.isArray(symbolSize)) {
	            symbolSize = [symbolSize, symbolSize];
	        }
	        var margin = spriteUtil.getMarginByStyle(style);
	        var width = symbolSize[0] + margin.left + margin.right;
	        var height = symbolSize[1] + margin.top + margin.bottom;
	        var path = echarts.helper.createSymbol(symbol, 0, 0, symbolSize[0], symbolSize[1]);

	        var size = Math.max(width, height);

	        path.position = [margin.left, margin.top];
	        if (width > height) {
	            path.position[1] += (size - height) / 2;
	        }
	        else {
	            path.position[0] += (size - width) / 2;
	        }

	        var rect = path.getBoundingRect();
	        path.position[0] -= rect.x;
	        path.position[1] -= rect.y;

	        path.setStyle(style);
	        path.update();

	        return {
	            image: makeSprite(size, canvas, function (ctx) {
	                path.brush(ctx);
	            }),
	            margin: margin
	        };
	    },

	    createSimpleSprite: function (size, canvas) {
	        return makeSprite(size, canvas, function (ctx) {
	            var halfSize = size / 2;
	            ctx.beginPath();
	            ctx.arc(halfSize, halfSize, 60, 0, Math.PI * 2, false) ;
	            ctx.closePath();

	            var gradient = ctx.createRadialGradient(
	                halfSize, halfSize, 0, halfSize, halfSize, halfSize
	            );
	            gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
	            gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
	            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
	            ctx.fillStyle = gradient;
	            ctx.fill();
	        });
	    }
	};

	module.exports = spriteUtil;

/***/ },
/* 98 */
/***/ function(module, exports) {

	module.exports = "@export ecgl.points.vertex\n\nuniform mat4 worldViewProjection : WORLDVIEWPROJECTION;\nuniform float elapsedTime : 0;\n\nattribute vec3 position : POSITION;\n#ifdef VERTEX_COLOR\nattribute vec4 a_Color : COLOR;\nvarying vec4 v_Color;\n#endif\nattribute float size;\n\n#ifdef ANIMATING\nattribute float delay;\n#endif\n\nvoid main()\n{\n    gl_Position = worldViewProjection * vec4(position, 1.0);\n\n#ifdef ANIMATING\n    gl_PointSize = size * (sin((elapsedTime + delay) * 3.14) * 0.5 + 1.0);\n#else\n    gl_PointSize = size;\n#endif\n\n#ifdef VERTEX_COLOR\n    v_Color = a_Color;\n#endif\n}\n\n@end\n\n@export ecgl.points.fragment\n\nuniform vec4 color: [1, 1, 1, 1];\n#ifdef VERTEX_COLOR\nvarying vec4 v_Color;\n#endif\n\nuniform sampler2D sprite;\n\nvoid main()\n{\n    gl_FragColor = color;\n\n#ifdef VERTEX_COLOR\n    gl_FragColor *= v_Color;\n#endif\n\n#ifdef SPRITE_ENABLED\n    gl_FragColor *= texture2D(sprite, gl_PointCoord);\n#endif\n\n    if (gl_FragColor.a == 0.0) {\n        discard;\n    }\n}\n@end"

/***/ },
/* 99 */
/***/ function(module, exports) {

	

	    module.exports = function (seriesType, defaultSymbolType, legendSymbol, ecModel, api) {

	        // Encoding visual for all series include which is filtered for legend drawing
	        ecModel.eachRawSeriesByType(seriesType, function (seriesModel) {
	            var data = seriesModel.getData();

	            var symbolType = seriesModel.get('symbol') || defaultSymbolType;
	            var symbolSize = seriesModel.get('symbolSize');

	            data.setVisual({
	                legendSymbol: legendSymbol || symbolType,
	                symbol: symbolType,
	                symbolSize: symbolSize
	            });

	            // Only visible series has each data be visual encoded
	            if (!ecModel.isSeriesFiltered(seriesModel)) {
	                if (typeof symbolSize === 'function') {
	                    data.each(function (idx) {
	                        var rawValue = seriesModel.getRawValue(idx);
	                        // FIXME
	                        var params = seriesModel.getDataParams(idx);
	                        data.setItemVisual(idx, 'symbolSize', symbolSize(rawValue, params));
	                    });
	                }
	                data.each(function (idx) {
	                    var itemModel = data.getItemModel(idx);
	                    var itemSymbolType = itemModel.getShallow('symbol', true);
	                    var itemSymbolSize = itemModel.getShallow('symbolSize', true);
	                    // If has item symbol
	                    if (itemSymbolType != null) {
	                        data.setItemVisual(idx, 'symbol', itemSymbolType);
	                    }
	                    if (itemSymbolSize != null) {
	                        // PENDING Transform symbolSize ?
	                        data.setItemVisual(idx, 'symbolSize', itemSymbolSize);
	                    }
	                });
	            }
	        });
	    };


/***/ }
/******/ ])
});
;