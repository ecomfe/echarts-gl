(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory(require("echarts"));
	else if(typeof define === 'function' && define.amd)
		define(["echarts"], factory);
	else if(typeof exports === 'object')
		exports["echarts-graph-modularity"] = factory(require("echarts"));
	else
		root["echarts-graph-modularity"] = factory(root["echarts"]);
})(this, function(__WEBPACK_EXTERNAL_MODULE_9__) {
return /******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, {
/******/ 				configurable: false,
/******/ 				enumerable: true,
/******/ 				get: getter
/******/ 			});
/******/ 		}
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(1);

/***/ }),
/* 1 */
/***/ (function(module, exports, __webpack_require__) {

var Modularity = __webpack_require__(2);
var echarts = __webpack_require__(9);
var createNGraph = __webpack_require__(10);

function createModularityVisual(chartType) {
    return function (ecModel, api) {
        var paletteScope = {};
        ecModel.eachSeriesByType(chartType, function (seriesModel) {
            var modularityOpt = seriesModel.get('modularity');
            if (modularityOpt) {
                var graph = seriesModel.getGraph();
                var idIndexMap = {};
                var ng = createNGraph();
                graph.data.each(function (idx) {
                    var node = graph.getNodeByIndex(idx);
                    idIndexMap[node.id] = idx;
                    ng.addNode(node.id);
                    return node.id;
                });
                graph.edgeData.each('value', function (val, idx) {
                    var edge = graph.getEdgeByIndex(idx);
                    ng.addLink(edge.node1.id, edge.node2.id);
                    return {
                        source: edge.node1.id,
                        target: edge.node2.id,
                        value: val
                    };
                });

                var modularity = new Modularity(seriesModel.get('modularity.resolution') || 1);
                var result = modularity.execute(ng);

                var communities = {};
                for (var id in result) {
                    var comm = result[id];
                    communities[comm] = communities[comm] || 0;
                    communities[comm]++;
                }
                var communitiesList = Object.keys(communities);
                if (seriesModel.get('modularity.sort')) {
                    communitiesList.sort(function (a, b) {
                        return b - a;
                    });
                }
                var colors = {};
                communitiesList.forEach(function (comm) {
                    colors[comm] = seriesModel.getColorFromPalette(comm, paletteScope);
                });

                for (var id in result) {
                    var comm = result[id];
                    graph.data.setItemVisual(idIndexMap[id], 'color', colors[comm]);
                }

                graph.edgeData.each(function (idx) {
                    var itemModel = graph.edgeData.getItemModel(idx);
                    var edge = graph.getEdgeByIndex(idx);
                    var color = itemModel.get('lineStyle.normal.color');

                    switch (color) {
                        case 'source':
                            color = edge.node1.getVisual('color');
                            break;
                        case 'target':
                            color = edge.node2.getVisual('color');
                            break;
                    }

                    if (color != null) {
                        edge.setVisual('color', color);
                    }
                });
            }
        });
    };
}

echarts.registerVisual(echarts.PRIORITY.VISUAL.CHART + 1, createModularityVisual('graph'));
echarts.registerVisual(echarts.PRIORITY.VISUAL.CHART + 1, createModularityVisual('graphGL'));

/***/ }),
/* 2 */
/***/ (function(module, exports, __webpack_require__) {

/*
 Copyright 2008-2011 Gephi
 Authors : Patick J. McSweeney <pjmcswee@syr.edu>, Sebastien Heymann <seb@gephi.org>
 Website : http://www.gephi.org

 This file is part of Gephi.

 DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS HEADER.

 Copyright 2011 Gephi Consortium. All rights reserved.

 The contents of this file are subject to the terms of either the GNU
 General Public License Version 3 only ("GPL") or the Common
 Development and Distribution License("CDDL") (collectively, the
 "License"). You may not use this file except in compliance with the
 License. You can obtain a copy of the License at
 http://gephi.org/about/legal/license-notice/
 or /cddl-1.0.txt and /gpl-3.0.txt. See the License for the
 specific language governing permissions and limitations under the
 License.  When distributing the software, include this License Header
 Notice in each file and include the License files at
 /cddl-1.0.txt and /gpl-3.0.txt. If applicable, add the following below the
 License Header, with the fields enclosed by brackets [] replaced by
 your own identifying information:
 "Portions Copyrighted [year] [name of copyright owner]"

 If you wish your version of this file to be governed by only the CDDL
 or only the GPL Version 3, indicate your decision by adding
 "[Contributor] elects to include this software in this distribution
 under the [CDDL or GPL Version 3] license." If you do not indicate a
 single choice of license, a recipient has the option to distribute
 your version of this file under either the CDDL, the GPL Version 3 or
 to extend the choice of license to its licensees as provided above.
 However, if you add GPL Version 3 code and therefore, elected the GPL
 Version 3 license, then the option applies only if the new code is
 made subject to such option by the copyright holder.

 Contributor(s): Thomas Aynaud <taynaud@gmail.com>

 Portions Copyrighted 2011 Gephi Consortium.
 */
var CommunityStructure = __webpack_require__(3)
    , centrality = __webpack_require__(6)
    ;

/**
 * @constructor
 */
function Modularity (resolution, useWeight) {
    this.isRandomized = false;
    this.useWeight = useWeight;
    this.resolution = resolution || 1.;
    /**
     * @type {CommunityStructure}
     */
    this.structure = null;
}

/**
 * @param {IGraph} graph
 */
Modularity.prototype.execute = function (graph/*, AttributeModel attributeModel*/) {


    this.structure = new CommunityStructure(graph, this.useWeight);

    var comStructure = new Array(graph.getNodesCount());

    var computedModularityMetrics = this.computeModularity(
        graph
        , this.structure
        , comStructure
        , this.resolution
        , this.isRandomized
        , this.useWeight
    );

    var result = {};
    this.structure.map.forEach(function (i, node) {
        result[node] = comStructure[i];
    });

    return result;

};


/**
 *
 * @param {IGraph} graph
 * @param {CommunityStructure} theStructure
 * @param {Array.<Number>} comStructure
 * @param {Number} currentResolution
 * @param {Boolean} randomized
 * @param {Boolean} weighted
 * @returns {Object.<String, Number>}
 */
Modularity.prototype.computeModularity = function(graph, theStructure, comStructure,  currentResolution, randomized, weighted) {


    function getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min)) + min;
    }

    var totalWeight = theStructure.graphWeightSum;
    var nodeDegrees = theStructure.weights.slice();


    var /** @type {Object.<String, Number>} */ results = Object.create(null);


    var someChange = true;

    while (someChange) {
        someChange = false;
        var localChange = true;
        while (localChange) {
            localChange = false;
            var start = 0;
            if (randomized) {
                //start = Math.abs(rand.nextInt()) % theStructure.N;
                start = getRandomInt(0,theStructure.N);
            }
            var step = 0;
            for (var i = start; step < theStructure.N; i = (i + 1) % theStructure.N) {
                step++;
                var bestCommunity = this.updateBestCommunity(theStructure, i, currentResolution);
                if ((theStructure.nodeCommunities[i] != bestCommunity) && (bestCommunity != null)) {
                    theStructure.moveNodeTo(i, bestCommunity);
                    localChange = true;
                }

            }

            someChange = localChange || someChange;

        }

        if (someChange) {
            theStructure.zoomOut();
        }
    }

    this.fillComStructure(graph, theStructure, comStructure);

    /*
    //TODO: uncomment when finalQ will be implemented
    var degreeCount = this.fillDegreeCount(graph, theStructure, comStructure, nodeDegrees, weighted);


    var computedModularity = this._finalQ(comStructure, degreeCount, graph, theStructure, totalWeight, 1., weighted);
    var computedModularityResolution = this._finalQ(comStructure, degreeCount, graph, theStructure, totalWeight, currentResolution, weighted);

    results["modularity"] =  computedModularity;
    results["modularityResolution"] =  computedModularityResolution;
    */

    return results;
};


/**
 * @param {CommunityStructure} theStructure
 * @param {Number} i
 * @param {Number} currentResolution
 * @returns {Community}
 */
Modularity.prototype.updateBestCommunity = function(theStructure,  i, currentResolution) {
    var best = this.q(i, theStructure.nodeCommunities[i], theStructure, currentResolution);
    var bestCommunity = theStructure.nodeCommunities[i];
    //var /*Set<Community>*/ iter = theStructure.nodeConnectionsWeight[i].keySet();
    theStructure.nodeConnectionsWeight[i].forEach(function (_$$val, com) {

        var qValue = this.q(i, com, theStructure, currentResolution);
        if (qValue > best) {
            best = qValue;
            bestCommunity = com;
        }

    }, this);
    return bestCommunity;
};

/**
 *
 * @param {IGraph} graph
 * @param {CommunityStructure} theStructure
 * @param {Array.<Number>} comStructure
 * @returns {Array.<Number>}
 */
Modularity.prototype.fillComStructure = function(graph, theStructure, comStructure) {

    var count = 0;

    theStructure.communities.forEach(function (com) {

        com.nodes.forEach(function (node) {

            var hidden = theStructure.invMap.get(node);
            hidden.nodes.forEach( function (nodeInt){
                comStructure[nodeInt] = count;
            });

        });
        count++;

    });


    return comStructure;
};

/**
 * @param {IGraph} graph
 * @param {CommunityStructure} theStructure
 * @param {Array.<Number>} comStructure
 * @param {Array.<Number>} nodeDegrees
 * @param {Boolean} weighted
 * @returns {Array.<Number>}
 */
Modularity.prototype.fillDegreeCount = function(graph, theStructure, comStructure, nodeDegrees, weighted) {

    var degreeCount = new Array(theStructure.communities.length);
    var degreeCentrality = centrality.degree(graph);

    graph.forEachNode(function(node){

        var index = theStructure.map.get(node);
        if (weighted) {
            degreeCount[comStructure[index]] += nodeDegrees[index];
        } else {
            degreeCount[comStructure[index]] += degreeCentrality[node.id];
        }

    });
    return degreeCount;

};


/**
 *
 * @param {Array.<Number>} struct
 * @param {Array.<Number>} degrees
 * @param {IGraph} graph
 * @param {CommunityStructure} theStructure
 * @param {Number} totalWeight
 * @param {Number} usedResolution
 * @param {Boolean} weighted
 * @returns {Number}
 */
Modularity.prototype._finalQ = function(struct, degrees, graph, theStructure, totalWeight, usedResolution, weighted) {

    //TODO: rewrite for wighted version of algorithm
    throw new Error("not implemented properly");
    var  res = 0;
    var  internal = new Array(degrees.length);

    graph.forEachNode(function(n){
        var n_index = theStructure.map.get(n);

        graph.forEachLinkedNode(n.id, function(neighbor){
            if (n == neighbor) {
                return;
            }
            var neigh_index = theStructure.map.get(neighbor);
            if (struct[neigh_index] == struct[n_index]) {
                if (weighted) {
                    //throw new Error("weighted aren't implemented");
                    //internal[struct[neigh_index]] += graph.getEdge(n, neighbor).getWeight();
                } else {
                    internal[struct[neigh_index]]++;
                }
            }
        }.bind(this), false);

    }.bind(this));

    for (var i = 0; i < degrees.length; i++) {
        internal[i] /= 2.0;
        res += usedResolution * (internal[i] / totalWeight) - Math.pow(degrees[i] / (2 * totalWeight), 2);//HERE
    }
    return res;
};



/**
 *
 * @param {Number} nodeId
 * @param {Community} community
 * @param {CommunityStructure} theStructure
 * @param {Number} currentResolution
 * @returns {Number}
 */
Modularity.prototype.q = function(nodeId, community, theStructure, currentResolution) {

    var edgesToFloat = theStructure.nodeConnectionsWeight[nodeId].get(community);
    var edgesTo = 0;
    if (edgesToFloat != null) {
        edgesTo = edgesToFloat;
    }
    var weightSum = community.weightSum;
    var nodeWeight = theStructure.weights[nodeId];
    var qValue = currentResolution * edgesTo - (nodeWeight * weightSum) / (2.0 * theStructure.graphWeightSum);
    if ((theStructure.nodeCommunities[nodeId] == community) && (theStructure.nodeCommunities[nodeId].size() > 1)) {
        qValue = currentResolution * edgesTo - (nodeWeight * (weightSum - nodeWeight)) / (2.0 * theStructure.graphWeightSum);
    }
    if ((theStructure.nodeCommunities[nodeId] == community) && (theStructure.nodeCommunities[nodeId].size() == 1)) {
        qValue = 0.;
    }
    return qValue;

};

module.exports = Modularity;

/***/ }),
/* 3 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var Community = __webpack_require__(4)
    , ModEdge = __webpack_require__(5)
    ;

/**
 *
 * @param {IGraph} graph
 * @param useWeight
 * @param {CommunityStructure} structure
 * @constructor
 */
function CommunityStructure(graph, useWeight) {

    //this.graph = graph;
    this.N = graph.getNodesCount();
    this.graphWeightSum = 0;
    this.structure = this;

    /** @type {Map.<Number, Community>} */
    this.invMap = new Map();

    /** @type {Array.< Map.<Community, Number> >} */
    this.nodeConnectionsWeight = new Array(this.N);

    /** @type {Array.< Map.<Community, Number> >} */
    this.nodeConnectionsCount = new Array(this.N);

    /** @type {Array.<Community>} */
    this.nodeCommunities = new Array(this.N);

    /** @type {Map.<Node, Number>} */
    this.map = new Map();

    /** @type {Array.< Array.<ModEdge> >} */
    this.topology = new Array(this.N);
    for (var i = 0; i < this.N; i++) this.topology[i] = [];

    /** @type {Array.<Community>} */
    this.communities = [];

    /**@type {Array.<Number>} */
    this.weights = new Array(this.N);

    var index = 0;

    graph.forEachNode(function (node) {

        this.map.set(node.id, index);
        this.nodeCommunities[index] = new Community(this);
        this.nodeConnectionsWeight[index] = new Map();
        this.nodeConnectionsCount[index] = new Map();
        this.weights[index] = 0;
        this.nodeCommunities[index].seed(index);
        var hidden = new Community(this);
        hidden.nodes.add(index);
        this.invMap.set(index, hidden);
        this.communities.push(this.nodeCommunities[index]);
        index++;

    }.bind(this));


    graph.forEachLink(function (link) {

        var node_index = this.map.get(link.fromId)
            , neighbor_index = this.map.get(link.toId)
            , weight = 1
            ;

        if (node_index === neighbor_index) {
            return;
        }

        if (useWeight) {
            weight = link.data.weight;
        }

        this.setUpLink(node_index, neighbor_index, weight);
        this.setUpLink(neighbor_index, node_index, weight);


    }.bind(this));


    this.graphWeightSum /= 2.0;
}


CommunityStructure.prototype.setUpLink = function (node_index, neighbor_index, weight) {

    this.weights[node_index] += weight;
    var /** @type {ModEdge} */ me = new ModEdge(node_index, neighbor_index, weight);
    this.topology[node_index].push(me);
    var /** @type {Community} **/ adjCom = this.nodeCommunities[neighbor_index];
    this.nodeConnectionsWeight[node_index].set(adjCom, weight);
    this.nodeConnectionsCount[node_index].set(adjCom, 1);
    this.nodeCommunities[node_index].connectionsWeight.set(adjCom, weight);
    this.nodeCommunities[node_index].connectionsCount.set(adjCom, 1);
    this.nodeConnectionsWeight[neighbor_index].set(this.nodeCommunities[node_index], weight);
    this.nodeConnectionsCount[neighbor_index].set(this.nodeCommunities[node_index], 1);
    this.nodeCommunities[neighbor_index].connectionsWeight.set(this.nodeCommunities[node_index], weight);
    this.nodeCommunities[neighbor_index].connectionsCount.set(this.nodeCommunities[node_index], 1);
    this.graphWeightSum += weight;

};

/**
 * @param {Number} node
 * @param {Community} to
 */
CommunityStructure.prototype.addNodeTo = function (node, to) {

    to.add(node);
    this.nodeCommunities[node] = to;

    var nodeTopology = this.topology[node];
    for (var topologyKey in nodeTopology) {

        //noinspection JSUnfilteredForInLoop
        var /** @type {ModEdge} */ e = nodeTopology[topologyKey];

        var neighbor = e.target;


        //Remove Node Connection to this community
        var neighEdgesTo = this.nodeConnectionsWeight[neighbor].get(to);
        if (neighEdgesTo === undefined) {
            this.nodeConnectionsWeight[neighbor].set(to, e.weight);
        } else {
            this.nodeConnectionsWeight[neighbor].set(to, neighEdgesTo + e.weight);
        }

        var neighCountEdgesTo = this.nodeConnectionsCount[neighbor].get(to);
        if (neighCountEdgesTo === undefined) {
            this.nodeConnectionsCount[neighbor].set(to, 1);
        } else {
            this.nodeConnectionsCount[neighbor].set(to, neighCountEdgesTo + 1);
        }


        var /** @type {Community} */ adjCom = this.nodeCommunities[neighbor];
        var wEdgesto = adjCom.connectionsWeight.get(to);
        if (wEdgesto === undefined) {
            adjCom.connectionsWeight.set(to, e.weight);
        } else {
            adjCom.connectionsWeight.set(to, wEdgesto + e.weight);
        }

        var cEdgesto = adjCom.connectionsCount.get(to);
        if (cEdgesto === undefined) {
            adjCom.connectionsCount.set(to, 1);
        } else {
            adjCom.connectionsCount.set(to, cEdgesto + 1);
        }

        var nodeEdgesTo = this.nodeConnectionsWeight[node].get(adjCom);
        if (nodeEdgesTo === undefined) {
            this.nodeConnectionsWeight[node].set(adjCom, e.weight);
        } else {
            this.nodeConnectionsWeight[node].set(adjCom, nodeEdgesTo + e.weight);
        }

        var nodeCountEdgesTo = this.nodeConnectionsCount[node].get(adjCom);
        if (nodeCountEdgesTo === undefined) {
            this.nodeConnectionsCount[node].set(adjCom, 1);
        } else {
            this.nodeConnectionsCount[node].set(adjCom, nodeCountEdgesTo + 1);
        }

        if (to != adjCom) {
            var comEdgesto = to.connectionsWeight.get(adjCom);
            if (comEdgesto === undefined) {
                to.connectionsWeight.set(adjCom, e.weight);
            } else {
                to.connectionsWeight.set(adjCom, comEdgesto + e.weight);
            }

            var comCountEdgesto = to.connectionsCount.get(adjCom);
            if (comCountEdgesto === undefined) {
                to.connectionsCount.set(adjCom, 1);
            } else {
                to.connectionsCount.set(adjCom, comCountEdgesto + 1);
            }

        }
    }
};

/**
 * @param {Number} node
 * @param {Community} source
 */
CommunityStructure.prototype.removeNodeFrom = function (node, source) {

    var community = this.nodeCommunities[node];


    var nodeTopology = this.topology[node];
    for (var topologyKey in nodeTopology) {

        //noinspection JSUnfilteredForInLoop
        var /** @type {ModEdge} */ e = nodeTopology[topologyKey];

        var neighbor = e.target;

        //Remove Node Connection to this community
        var edgesTo = this.nodeConnectionsWeight[neighbor].get(community);
        var countEdgesTo = this.nodeConnectionsCount[neighbor].get(community);

        if ((countEdgesTo - 1) == 0) {
            this.nodeConnectionsWeight[neighbor].delete(community);
            this.nodeConnectionsCount[neighbor].delete(community);
        } else {
            this.nodeConnectionsWeight[neighbor].set(community, edgesTo - e.weight);
            this.nodeConnectionsCount[neighbor].set(community, countEdgesTo - 1);
        }


        //Remove Adjacency Community's connection to this community
        var adjCom = this.nodeCommunities[neighbor];
        var oEdgesto = adjCom.connectionsWeight.get(community);
        var oCountEdgesto = adjCom.connectionsCount.get(community);
        if ((oCountEdgesto - 1) == 0) {
            adjCom.connectionsWeight.delete(community);
            adjCom.connectionsCount.delete(community);
        } else {
            adjCom.connectionsWeight.set(community, oEdgesto - e.weight);
            adjCom.connectionsCount.set(community, oCountEdgesto - 1);
        }

        if (node == neighbor) {
            continue;
        }

        if (adjCom != community) {

            var comEdgesto = community.connectionsWeight.get(adjCom);
            var comCountEdgesto = community.connectionsCount.get(adjCom);

            if (comCountEdgesto - 1 == 0) {
                community.connectionsWeight.delete(adjCom);
                community.connectionsCount.delete(adjCom);
            } else {
                community.connectionsWeight.set(adjCom, comEdgesto - e.weight);
                community.connectionsCount.set(adjCom, comCountEdgesto - 1);
            }

        }

        var nodeEdgesTo = this.nodeConnectionsWeight[node].get(adjCom);
        var nodeCountEdgesTo = this.nodeConnectionsCount[node].get(adjCom);

        if ((nodeCountEdgesTo - 1) == 0) {
            this.nodeConnectionsWeight[node].delete(adjCom);
            this.nodeConnectionsCount[node].delete(adjCom);
        } else {
            this.nodeConnectionsWeight[node].set(adjCom, nodeEdgesTo - e.weight);
            this.nodeConnectionsCount[node].set(adjCom, nodeCountEdgesTo - 1);
        }

    }

    source.remove(node);
};

/**
 * @param {Number} node
 * @param {Community} to
 */
CommunityStructure.prototype.moveNodeTo = function (node, to) {

    var source = this.nodeCommunities[node];
    this.removeNodeFrom(node, source);
    this.addNodeTo(node, to);

};


CommunityStructure.prototype.zoomOut = function () {
    var realCommunities = this.communities.reduce(function (arr, value) {
        arr.push(value);
        return arr;
    }, []);
    var M = realCommunities.length; // size
    var /** @type Array.< Array.<ModEdge> > */ newTopology = new Array(M);
    var index = 0;

    this.nodeCommunities = new Array(M);
    this.nodeConnectionsWeight = new Array(M);
    this.nodeConnectionsCount = new Array(M);

    var /** @type Map.<Number, Community>*/ newInvMap = new Map();
    realCommunities.forEach(function (com) {

        var weightSum = 0;
        this.nodeConnectionsWeight[index] = new Map();
        this.nodeConnectionsCount[index] = new Map();
        newTopology[index] = [];
        this.nodeCommunities[index] = new Community(com);
        //var iter = com.connectionsWeight.keySet();

        var hidden = new Community(this.structure);

        com.nodes.forEach(function (nodeInt) {

            var oldHidden = this.invMap.get(nodeInt);
            oldHidden.nodes.forEach(hidden.nodes.add.bind(hidden.nodes));

        }, this);

        newInvMap.set(index, hidden);
        com.connectionsWeight.forEach(function (weight, adjCom) {

            var target = realCommunities.indexOf(adjCom);
            if (!~target) return;
            if (target == index) {
                weightSum += 2. * weight;
            } else {
                weightSum += weight;
            }
            var e = new ModEdge(index, target, weight);
            newTopology[index].push(e);

        }, this);

        this.weights[index] = weightSum;
        this.nodeCommunities[index].seed(index);

        index++;

    }.bind(this));

    this.communities = [];

    for (var i = 0; i < M; i++) {
        var com = this.nodeCommunities[i];
        this.communities.push(com);
        for (var ei in newTopology[i]) {
            //noinspection JSUnfilteredForInLoop
            var e = newTopology[i][ei];
            this.nodeConnectionsWeight[i].set(this.nodeCommunities[e.target], e.weight);
            this.nodeConnectionsCount[i].set(this.nodeCommunities[e.target], 1);
            com.connectionsWeight.set(this.nodeCommunities[e.target], e.weight);
            com.connectionsCount.set(this.nodeCommunities[e.target], 1);
        }

    }

    this.N = M;
    this.topology = newTopology;
    this.invMap = newInvMap;

};

module.exports = CommunityStructure;

/***/ }),
/* 4 */
/***/ (function(module, exports) {

/**
 * @param {CommunityStructure|Community} com
 * @constructor
 */
function Community(com) {

    /** @type {CommunityStructure} */
    this.structure = com.structure ? com.structure : com;

    /** @type {Map.<Community, Number>} */
    this.connectionsWeight = new Map();

    /** @type {Map.<Community, Number>} */
    this.connectionsCount = new Map();

    /** @type {Set.<Number>} */
    this.nodes = new Set;

    this.weightSum = 0;


}

/**
 * @public
 * @returns {Number}
 */
Community.prototype.size = function() {
    return this.nodes.size;
};


/**
 * @param {Number} node
 */
Community.prototype.seed = function(node) {

    this.nodes.add(node);
    this.weightSum += this.structure.weights[node];

};

/**
 * @param {Number} nodeId
 * @returns {boolean}
 */
Community.prototype.add = function(nodeId) {

    this.nodes.add(nodeId);
    this.weightSum += this.structure.weights[nodeId];
    return true;

};

/**
 * @param {Number} node
 * @returns {boolean}
 */
Community.prototype.remove = function(node) {

    var result = this.nodes.delete(node);

    this.weightSum -= this.structure.weights[node];
    if (!this.nodes.size) {
        var index = this.structure.communities.indexOf(this);
        delete this.structure.communities[index];
    }

    return result;
};

module.exports = Community;


/***/ }),
/* 5 */
/***/ (function(module, exports) {

/**
 *
 * @param s
 * @param t
 * @param w
 * @constructor
 */
function ModEdge(s, t, w) {
    /** @type {Number} */
    this.source = s;
    /** @type {Number} */
    this.target = t;
    /** @type {Number} */
    this.weight = w;
}

module.exports = ModEdge;


/***/ }),
/* 6 */
/***/ (function(module, exports, __webpack_require__) {

module.exports.degree = __webpack_require__(7);
module.exports.betweenness = __webpack_require__(8);


/***/ }),
/* 7 */
/***/ (function(module, exports) {

module.exports = degree;

/**
 * Calculates graph nodes degree centrality (in/out or both).
 *
 * @see http://en.wikipedia.org/wiki/Centrality#Degree_centrality
 *
 * @param {ngraph.graph} graph object for which we are calculating centrality.
 * @param {string} [kind=both] What kind of degree centrality needs to be calculated:
 *   'in'    - calculate in-degree centrality
 *   'out'   - calculate out-degree centrality
 *   'inout' - (default) generic degree centrality is calculated
 */
function degree(graph, kind) {
  var getNodeDegree,
    sortedDegrees = [],
    result = Object.create(null),
    nodeDegree;

  kind = (kind || 'both').toLowerCase();
  if (kind === 'both' || kind === 'inout') {
    getNodeDegree = inoutDegreeCalculator;
  } else if (kind === 'in') {
    getNodeDegree = inDegreeCalculator;
  } else if (kind === 'out') {
    getNodeDegree = outDegreeCalculator;
  } else {
    throw new Error('Expected centrality degree kind is: in, out or both');
  }

  graph.forEachNode(calculateNodeDegree);

  return result;

  function calculateNodeDegree(node) {
    var links = graph.getLinks(node.id);
    result[node.id] = getNodeDegree(links, node.id);
  }
}

function inDegreeCalculator(links, nodeId) {
  var total = 0;
  if (!links) return total;

  for (var i = 0; i < links.length; i += 1) {
    total += (links[i].toId === nodeId) ? 1 : 0;
  }
  return total;
}

function outDegreeCalculator(links, nodeId) {
  var total = 0;
  if (!links) return total;

  for (var i = 0; i < links.length; i += 1) {
    total += (links[i].fromId === nodeId) ? 1 : 0;
  }
  return total;
}

function inoutDegreeCalculator(links) {
  if (!links) return 0;

  return links.length;
}


/***/ }),
/* 8 */
/***/ (function(module, exports) {

module.exports = betweennes;

/**
 * I'm using http://www.inf.uni-konstanz.de/algo/publications/b-vspbc-08.pdf
 * as a reference for this implementation
 */
function betweennes(graph, oriented) {
  var Q = [],
    S = []; // Queue and Stack
  // list of predcessors on shorteest paths from source
  var pred = Object.create(null);
  // distance from source
  var dist = Object.create(null);
  // number of shortest paths from source to key
  var sigma = Object.create(null);
  // dependency of source on key
  var delta = Object.create(null);

  var currentNode;
  var centrality = Object.create(null);

  graph.forEachNode(setCentralityToZero);
  graph.forEachNode(calculateCentrality);

  if (!oriented) {
    // The centrality scores need to be divided by two if the graph is not oriented,
    // since all shortest paths are considered twice
    Object.keys(centrality).forEach(divideByTwo);
  }

  return centrality;

  function divideByTwo(key) {
    centrality[key] /= 2;
  }

  function setCentralityToZero(node) {
    centrality[node.id] = 0;
  }

  function calculateCentrality(node) {
    currentNode = node.id;
    singleSourceShortestPath(currentNode);
    accumulate();
  }

  function accumulate() {
    graph.forEachNode(setDeltaToZero);
    while (S.length) {
      var w = S.pop();
      var coeff = (1 + delta[w])/sigma[w];
      var predcessors = pred[w];
      for (var idx = 0; idx < predcessors.length; ++idx) {
        var v = predcessors[idx];
        delta[v] += sigma[v] * coeff;
      }
      if (w !== currentNode) {
        centrality[w] += delta[w];
      }
    }
  }

  function setDeltaToZero(node) {
    delta[node.id] = 0;
  }

  function singleSourceShortestPath(source) {
    graph.forEachNode(initNode);
    dist[source] = 0;
    sigma[source] = 1;
    Q.push(source);

    while (Q.length) {
      var v = Q.shift();
      var dedup = Object.create(null);
      S.push(v);
      graph.forEachLinkedNode(v, toId, oriented);
    }

    function toId(otherNode) {
      // NOTE: This code will also consider multi-edges, which are often
      // ignored by popular software (Gephi/NetworkX). Depending on your use
      // case this may not be desired and deduping needs to be performed. To
      // save memory I'm not deduping here...
      processNode(otherNode.id);
    }

    function initNode(node) {
      var nodeId = node.id;
      pred[nodeId] = []; // empty list
      dist[nodeId] = -1;
      sigma[nodeId] = 0;
    }

    function processNode(w) {
      // path discovery
      if (dist[w] === -1) {
        // Node w is found for the first time
        dist[w] = dist[v] + 1;
        Q.push(w);
      }
      // path counting
      if (dist[w] === dist[v] + 1) {
        // edge (v, w) on a shortest path
        sigma[w] += sigma[v];
        pred[w].push(v);
      }
    }
  }
}


/***/ }),
/* 9 */
/***/ (function(module, exports) {

module.exports = __WEBPACK_EXTERNAL_MODULE_9__;

/***/ }),
/* 10 */
/***/ (function(module, exports, __webpack_require__) {

/**
 * @fileOverview Contains definition of the core graph object.
 */

/**
 * @example
 *  var graph = require('ngraph.graph')();
 *  graph.addNode(1);     // graph has one node.
 *  graph.addLink(2, 3);  // now graph contains three nodes and one link.
 *
 */
module.exports = createGraph;

var eventify = __webpack_require__(11);

/**
 * Creates a new graph
 */
function createGraph(options) {
  // Graph structure is maintained as dictionary of nodes
  // and array of links. Each node has 'links' property which
  // hold all links related to that node. And general links
  // array is used to speed up all links enumeration. This is inefficient
  // in terms of memory, but simplifies coding.
  options = options || {};
  if (options.uniqueLinkId === undefined) {
    // Request each link id to be unique between same nodes. This negatively
    // impacts `addLink()` performance (O(n), where n - number of edges of each
    // vertex), but makes operations with multigraphs more accessible.
    options.uniqueLinkId = true;
  }

  var nodes = typeof Object.create === 'function' ? Object.create(null) : {},
    links = [],
    // Hash of multi-edges. Used to track ids of edges between same nodes
    multiEdges = {},
    nodesCount = 0,
    suspendEvents = 0,

    forEachNode = createNodeIterator(),
    createLink = options.uniqueLinkId ? createUniqueLink : createSingleLink,

    // Our graph API provides means to listen to graph changes. Users can subscribe
    // to be notified about changes in the graph by using `on` method. However
    // in some cases they don't use it. To avoid unnecessary memory consumption
    // we will not record graph changes until we have at least one subscriber.
    // Code below supports this optimization.
    //
    // Accumulates all changes made during graph updates.
    // Each change element contains:
    //  changeType - one of the strings: 'add', 'remove' or 'update';
    //  node - if change is related to node this property is set to changed graph's node;
    //  link - if change is related to link this property is set to changed graph's link;
    changes = [],
    recordLinkChange = noop,
    recordNodeChange = noop,
    enterModification = noop,
    exitModification = noop;

  // this is our public API:
  var graphPart = {
    /**
     * Adds node to the graph. If node with given id already exists in the graph
     * its data is extended with whatever comes in 'data' argument.
     *
     * @param nodeId the node's identifier. A string or number is preferred.
     * @param [data] additional data for the node being added. If node already
     *   exists its data object is augmented with the new one.
     *
     * @return {node} The newly added node or node with given id if it already exists.
     */
    addNode: addNode,

    /**
     * Adds a link to the graph. The function always create a new
     * link between two nodes. If one of the nodes does not exists
     * a new node is created.
     *
     * @param fromId link start node id;
     * @param toId link end node id;
     * @param [data] additional data to be set on the new link;
     *
     * @return {link} The newly created link
     */
    addLink: addLink,

    /**
     * Removes link from the graph. If link does not exist does nothing.
     *
     * @param link - object returned by addLink() or getLinks() methods.
     *
     * @returns true if link was removed; false otherwise.
     */
    removeLink: removeLink,

    /**
     * Removes node with given id from the graph. If node does not exist in the graph
     * does nothing.
     *
     * @param nodeId node's identifier passed to addNode() function.
     *
     * @returns true if node was removed; false otherwise.
     */
    removeNode: removeNode,

    /**
     * Gets node with given identifier. If node does not exist undefined value is returned.
     *
     * @param nodeId requested node identifier;
     *
     * @return {node} in with requested identifier or undefined if no such node exists.
     */
    getNode: getNode,

    /**
     * Gets number of nodes in this graph.
     *
     * @return number of nodes in the graph.
     */
    getNodesCount: function() {
      return nodesCount;
    },

    /**
     * Gets total number of links in the graph.
     */
    getLinksCount: function() {
      return links.length;
    },

    /**
     * Gets all links (inbound and outbound) from the node with given id.
     * If node with given id is not found null is returned.
     *
     * @param nodeId requested node identifier.
     *
     * @return Array of links from and to requested node if such node exists;
     *   otherwise null is returned.
     */
    getLinks: getLinks,

    /**
     * Invokes callback on each node of the graph.
     *
     * @param {Function(node)} callback Function to be invoked. The function
     *   is passed one argument: visited node.
     */
    forEachNode: forEachNode,

    /**
     * Invokes callback on every linked (adjacent) node to the given one.
     *
     * @param nodeId Identifier of the requested node.
     * @param {Function(node, link)} callback Function to be called on all linked nodes.
     *   The function is passed two parameters: adjacent node and link object itself.
     * @param oriented if true graph treated as oriented.
     */
    forEachLinkedNode: forEachLinkedNode,

    /**
     * Enumerates all links in the graph
     *
     * @param {Function(link)} callback Function to be called on all links in the graph.
     *   The function is passed one parameter: graph's link object.
     *
     * Link object contains at least the following fields:
     *  fromId - node id where link starts;
     *  toId - node id where link ends,
     *  data - additional data passed to graph.addLink() method.
     */
    forEachLink: forEachLink,

    /**
     * Suspend all notifications about graph changes until
     * endUpdate is called.
     */
    beginUpdate: enterModification,

    /**
     * Resumes all notifications about graph changes and fires
     * graph 'changed' event in case there are any pending changes.
     */
    endUpdate: exitModification,

    /**
     * Removes all nodes and links from the graph.
     */
    clear: clear,

    /**
     * Detects whether there is a link between two nodes.
     * Operation complexity is O(n) where n - number of links of a node.
     * NOTE: this function is synonim for getLink()
     *
     * @returns link if there is one. null otherwise.
     */
    hasLink: getLink,

    /**
     * Gets an edge between two nodes.
     * Operation complexity is O(n) where n - number of links of a node.
     *
     * @param {string} fromId link start identifier
     * @param {string} toId link end identifier
     *
     * @returns link if there is one. null otherwise.
     */
    getLink: getLink
  };

  // this will add `on()` and `fire()` methods.
  eventify(graphPart);

  monitorSubscribers();

  return graphPart;

  function monitorSubscribers() {
    var realOn = graphPart.on;

    // replace real `on` with our temporary on, which will trigger change
    // modification monitoring:
    graphPart.on = on;

    function on() {
      // now it's time to start tracking stuff:
      graphPart.beginUpdate = enterModification = enterModificationReal;
      graphPart.endUpdate = exitModification = exitModificationReal;
      recordLinkChange = recordLinkChangeReal;
      recordNodeChange = recordNodeChangeReal;

      // this will replace current `on` method with real pub/sub from `eventify`.
      graphPart.on = realOn;
      // delegate to real `on` handler:
      return realOn.apply(graphPart, arguments);
    }
  }

  function recordLinkChangeReal(link, changeType) {
    changes.push({
      link: link,
      changeType: changeType
    });
  }

  function recordNodeChangeReal(node, changeType) {
    changes.push({
      node: node,
      changeType: changeType
    });
  }

  function addNode(nodeId, data) {
    if (nodeId === undefined) {
      throw new Error('Invalid node identifier');
    }

    enterModification();

    var node = getNode(nodeId);
    if (!node) {
      node = new Node(nodeId);
      nodesCount++;
      recordNodeChange(node, 'add');
    } else {
      recordNodeChange(node, 'update');
    }

    node.data = data;

    nodes[nodeId] = node;

    exitModification();
    return node;
  }

  function getNode(nodeId) {
    return nodes[nodeId];
  }

  function removeNode(nodeId) {
    var node = getNode(nodeId);
    if (!node) {
      return false;
    }

    enterModification();

    if (node.links) {
      while (node.links.length) {
        var link = node.links[0];
        removeLink(link);
      }
    }

    delete nodes[nodeId];
    nodesCount--;

    recordNodeChange(node, 'remove');

    exitModification();

    return true;
  }


  function addLink(fromId, toId, data) {
    enterModification();

    var fromNode = getNode(fromId) || addNode(fromId);
    var toNode = getNode(toId) || addNode(toId);

    var link = createLink(fromId, toId, data);

    links.push(link);

    // TODO: this is not cool. On large graphs potentially would consume more memory.
    addLinkToNode(fromNode, link);
    if (fromId !== toId) {
      // make sure we are not duplicating links for self-loops
      addLinkToNode(toNode, link);
    }

    recordLinkChange(link, 'add');

    exitModification();

    return link;
  }

  function createSingleLink(fromId, toId, data) {
    var linkId = makeLinkId(fromId, toId);
    return new Link(fromId, toId, data, linkId);
  }

  function createUniqueLink(fromId, toId, data) {
    // TODO: Get rid of this method.
    var linkId = makeLinkId(fromId, toId);
    var isMultiEdge = multiEdges.hasOwnProperty(linkId);
    if (isMultiEdge || getLink(fromId, toId)) {
      if (!isMultiEdge) {
        multiEdges[linkId] = 0;
      }
      var suffix = '@' + (++multiEdges[linkId]);
      linkId = makeLinkId(fromId + suffix, toId + suffix);
    }

    return new Link(fromId, toId, data, linkId);
  }

  function getLinks(nodeId) {
    var node = getNode(nodeId);
    return node ? node.links : null;
  }

  function removeLink(link) {
    if (!link) {
      return false;
    }
    var idx = indexOfElementInArray(link, links);
    if (idx < 0) {
      return false;
    }

    enterModification();

    links.splice(idx, 1);

    var fromNode = getNode(link.fromId);
    var toNode = getNode(link.toId);

    if (fromNode) {
      idx = indexOfElementInArray(link, fromNode.links);
      if (idx >= 0) {
        fromNode.links.splice(idx, 1);
      }
    }

    if (toNode) {
      idx = indexOfElementInArray(link, toNode.links);
      if (idx >= 0) {
        toNode.links.splice(idx, 1);
      }
    }

    recordLinkChange(link, 'remove');

    exitModification();

    return true;
  }

  function getLink(fromNodeId, toNodeId) {
    // TODO: Use sorted links to speed this up
    var node = getNode(fromNodeId),
      i;
    if (!node || !node.links) {
      return null;
    }

    for (i = 0; i < node.links.length; ++i) {
      var link = node.links[i];
      if (link.fromId === fromNodeId && link.toId === toNodeId) {
        return link;
      }
    }

    return null; // no link.
  }

  function clear() {
    enterModification();
    forEachNode(function(node) {
      removeNode(node.id);
    });
    exitModification();
  }

  function forEachLink(callback) {
    var i, length;
    if (typeof callback === 'function') {
      for (i = 0, length = links.length; i < length; ++i) {
        callback(links[i]);
      }
    }
  }

  function forEachLinkedNode(nodeId, callback, oriented) {
    var node = getNode(nodeId);

    if (node && node.links && typeof callback === 'function') {
      if (oriented) {
        return forEachOrientedLink(node.links, nodeId, callback);
      } else {
        return forEachNonOrientedLink(node.links, nodeId, callback);
      }
    }
  }

  function forEachNonOrientedLink(links, nodeId, callback) {
    var quitFast;
    for (var i = 0; i < links.length; ++i) {
      var link = links[i];
      var linkedNodeId = link.fromId === nodeId ? link.toId : link.fromId;

      quitFast = callback(nodes[linkedNodeId], link);
      if (quitFast) {
        return true; // Client does not need more iterations. Break now.
      }
    }
  }

  function forEachOrientedLink(links, nodeId, callback) {
    var quitFast;
    for (var i = 0; i < links.length; ++i) {
      var link = links[i];
      if (link.fromId === nodeId) {
        quitFast = callback(nodes[link.toId], link);
        if (quitFast) {
          return true; // Client does not need more iterations. Break now.
        }
      }
    }
  }

  // we will not fire anything until users of this library explicitly call `on()`
  // method.
  function noop() {}

  // Enter, Exit modification allows bulk graph updates without firing events.
  function enterModificationReal() {
    suspendEvents += 1;
  }

  function exitModificationReal() {
    suspendEvents -= 1;
    if (suspendEvents === 0 && changes.length > 0) {
      graphPart.fire('changed', changes);
      changes.length = 0;
    }
  }

  function createNodeIterator() {
    // Object.keys iterator is 1.3x faster than `for in` loop.
    // See `https://github.com/anvaka/ngraph.graph/tree/bench-for-in-vs-obj-keys`
    // branch for perf test
    return Object.keys ? objectKeysIterator : forInIterator;
  }

  function objectKeysIterator(callback) {
    if (typeof callback !== 'function') {
      return;
    }

    var keys = Object.keys(nodes);
    for (var i = 0; i < keys.length; ++i) {
      if (callback(nodes[keys[i]])) {
        return true; // client doesn't want to proceed. Return.
      }
    }
  }

  function forInIterator(callback) {
    if (typeof callback !== 'function') {
      return;
    }
    var node;

    for (node in nodes) {
      if (callback(nodes[node])) {
        return true; // client doesn't want to proceed. Return.
      }
    }
  }
}

// need this for old browsers. Should this be a separate module?
function indexOfElementInArray(element, array) {
  if (!array) return -1;

  if (array.indexOf) {
    return array.indexOf(element);
  }

  var len = array.length,
    i;

  for (i = 0; i < len; i += 1) {
    if (array[i] === element) {
      return i;
    }
  }

  return -1;
}

/**
 * Internal structure to represent node;
 */
function Node(id) {
  this.id = id;
  this.links = null;
  this.data = null;
}

function addLinkToNode(node, link) {
  if (node.links) {
    node.links.push(link);
  } else {
    node.links = [link];
  }
}

/**
 * Internal structure to represent links;
 */
function Link(fromId, toId, data, id) {
  this.fromId = fromId;
  this.toId = toId;
  this.data = data;
  this.id = id;
}

function hashCode(str) {
  var hash = 0, i, chr, len;
  if (str.length == 0) return hash;
  for (i = 0, len = str.length; i < len; i++) {
    chr   = str.charCodeAt(i);
    hash  = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}

function makeLinkId(fromId, toId) {
  return hashCode(fromId.toString() + '👉 ' + toId.toString());
}


/***/ }),
/* 11 */
/***/ (function(module, exports) {

module.exports = function(subject) {
  validateSubject(subject);

  var eventsStorage = createEventsStorage(subject);
  subject.on = eventsStorage.on;
  subject.off = eventsStorage.off;
  subject.fire = eventsStorage.fire;
  return subject;
};

function createEventsStorage(subject) {
  // Store all event listeners to this hash. Key is event name, value is array
  // of callback records.
  //
  // A callback record consists of callback function and its optional context:
  // { 'eventName' => [{callback: function, ctx: object}] }
  var registeredEvents = Object.create(null);

  return {
    on: function (eventName, callback, ctx) {
      if (typeof callback !== 'function') {
        throw new Error('callback is expected to be a function');
      }
      var handlers = registeredEvents[eventName];
      if (!handlers) {
        handlers = registeredEvents[eventName] = [];
      }
      handlers.push({callback: callback, ctx: ctx});

      return subject;
    },

    off: function (eventName, callback) {
      var wantToRemoveAll = (typeof eventName === 'undefined');
      if (wantToRemoveAll) {
        // Killing old events storage should be enough in this case:
        registeredEvents = Object.create(null);
        return subject;
      }

      if (registeredEvents[eventName]) {
        var deleteAllCallbacksForEvent = (typeof callback !== 'function');
        if (deleteAllCallbacksForEvent) {
          delete registeredEvents[eventName];
        } else {
          var callbacks = registeredEvents[eventName];
          for (var i = 0; i < callbacks.length; ++i) {
            if (callbacks[i].callback === callback) {
              callbacks.splice(i, 1);
            }
          }
        }
      }

      return subject;
    },

    fire: function (eventName) {
      var callbacks = registeredEvents[eventName];
      if (!callbacks) {
        return subject;
      }

      var fireArguments;
      if (arguments.length > 1) {
        fireArguments = Array.prototype.splice.call(arguments, 1);
      }
      for(var i = 0; i < callbacks.length; ++i) {
        var callbackInfo = callbacks[i];
        callbackInfo.callback.apply(callbackInfo.ctx, fireArguments);
      }

      return subject;
    }
  };
}

function validateSubject(subject) {
  if (!subject) {
    throw new Error('Eventify cannot use falsy object as events subject');
  }
  var reservedWords = ['on', 'fire', 'off'];
  for (var i = 0; i < reservedWords.length; ++i) {
    if (subject.hasOwnProperty(reservedWords[i])) {
      throw new Error("Subject cannot be eventified, since it already has property '" + reservedWords[i] + "'");
    }
  }
}


/***/ })
/******/ ]);
});