/****************************
 * Vector2 math functions
 ***************************/

function forceAtlas2Worker() {
    var vec2 = {
        create: function() {
            return new Float32Array(2);
        },
        dist: function(a, b) {
            var x = b[0] - a[0];
            var y = b[1] - a[1];
            return Math.sqrt(x*x + y*y);
        },
        len: function(a) {
            var x = a[0];
            var y = a[1];
            return Math.sqrt(x*x + y*y);
        },
        scaleAndAdd: function(out, a, b, scale) {
            out[0] = a[0] + b[0] * scale;
            out[1] = a[1] + b[1] * scale;
            return out;
        },
        scale: function(out, a, b) {
            out[0] = a[0] * b;
            out[1] = a[1] * b;
            return out;
        },
        add: function(out, a, b) {
            out[0] = a[0] + b[0];
            out[1] = a[1] + b[1];
            return out;
        },
        sub: function(out, a, b) {
            out[0] = a[0] - b[0];
            out[1] = a[1] - b[1];
            return out;
        },
        normalize: function(out, a) {
            var x = a[0];
            var y = a[1];
            var len = x*x + y*y;
            if (len > 0) {
                //TODO: evaluate use of glm_invsqrt here?
                len = 1 / Math.sqrt(len);
                out[0] = a[0] * len;
                out[1] = a[1] * len;
            }
            return out;
        },
        negate: function(out, a) {
            out[0] = -a[0];
            out[1] = -a[1];
            return out;
        },
        copy: function(out, a) {
            out[0] = a[0];
            out[1] = a[1];
            return out;
        },
        set: function(out, x, y) {
            out[0] = x;
            out[1] = y;
            return out;
        }
    }

    /****************************
     * Class: Region
     ***************************/

    function Region() {

        this.subRegions = [];

        this.nSubRegions = 0;

        this.node = null;

        this.mass = 0;

        this.centerOfMass = null;

        this.bbox = new Float32Array(4);

        this.size = 0;
    }

    var regionProto = Region.prototype;

    // Reset before update
    regionProto.beforeUpdate = function() {
        for (var i = 0; i < this.nSubRegions; i++) {
            this.subRegions[i].beforeUpdate();
        }
        this.mass = 0;
        if (this.centerOfMass) {
            this.centerOfMass[0] = 0;
            this.centerOfMass[1] = 0;
        }
        this.nSubRegions = 0;
        this.node = null;
    };
    // Clear after update
    regionProto.afterUpdate = function() {
        this.subRegions.length = this.nSubRegions;
        for (var i = 0; i < this.nSubRegions; i++) {
            this.subRegions[i].afterUpdate();
        }
    };

    regionProto.addNode = function(node) {
        if (this.nSubRegions === 0) {
            if (this.node == null) {
                this.node = node;
                return;
            }
            // Already have node, subdivide self.
            else {
                this._addNodeToSubRegion(this.node);
                this.node = null;
            }
        }
        this._addNodeToSubRegion(node);

        this._updateCenterOfMass(node);
    };

    regionProto.findSubRegion = function(x, y) {
        for (var i = 0; i < this.nSubRegions; i++) {
            var region = this.subRegions[i];
            if (region.contain(x, y)) {
                return region;
            }
        }
    };

    regionProto.contain = function(x, y) {
        return this.bbox[0] <= x
            && this.bbox[2] >= x
            && this.bbox[1] <= y
            && this.bbox[3] >= y;
    };

    regionProto.setBBox = function(minX, minY, maxX, maxY) {
        // Min
        this.bbox[0] = minX;
        this.bbox[1] = minY;
        // Max
        this.bbox[2] = maxX;
        this.bbox[3] = maxY;

        this.size = (maxX - minX + maxY - minY) / 2;
    };

    regionProto._newSubRegion = function() {
        var subRegion = this.subRegions[this.nSubRegions];
        if (!subRegion) {
            subRegion = new Region();
            this.subRegions[this.nSubRegions] = subRegion;
        }
        this.nSubRegions++;
        return subRegion;
    };

    regionProto._addNodeToSubRegion = function(node) {
        var subRegion = this.findSubRegion(node.position[0], node.position[1]);
        var bbox = this.bbox;
        if (!subRegion) {
            var cx = (bbox[0] + bbox[2]) / 2;
            var cy = (bbox[1] + bbox[3]) / 2;
            var w = (bbox[2] - bbox[0]) / 2;
            var h = (bbox[3] - bbox[1]) / 2;

            var xi = node.position[0] >= cx ? 1 : 0;
            var yi = node.position[1] >= cy ? 1 : 0;

            var subRegion = this._newSubRegion();
            // Min
            subRegion.setBBox(
                // Min
                xi * w + bbox[0],
                yi * h + bbox[1],
                // Max
                (xi + 1) * w + bbox[0],
                (yi + 1) * h + bbox[1]
            );
        }

        subRegion.addNode(node);
    };

    regionProto._updateCenterOfMass = function(node) {
        // Incrementally update
        if (this.centerOfMass == null) {
            this.centerOfMass = new Float32Array(2);
        }
        var x = this.centerOfMass[0] * this.mass;
        var y = this.centerOfMass[1] * this.mass;
        x += node.position[0] * node.mass;
        y += node.position[1] * node.mass;
        this.mass += node.mass;
        this.centerOfMass[0] = x / this.mass;
        this.centerOfMass[1] = y / this.mass;
    };

    /****************************
     * Class: Graph Node
     ***************************/
    function GraphNode() {
        this.position = new Float32Array(2);

        this.force = vec2.create();
        this.forcePrev = vec2.create();

        // If repulsionByDegree is true
        //  mass = inDegree + outDegree + 1
        // Else
        //  mass is manually set
        this.mass = 1;

        this.inDegree = 0;
        this.outDegree = 0;

        // Optional
        // this.size = 1;
    }

    /****************************
     * Class: Graph Edge
     ***************************/
    function GraphEdge(source, target) {
        this.source = source;
        this.target = target;

        this.weight = 1;
    }

    /****************************
     * Class: ForceStlas2
     ***************************/
    function ForceAtlas2() {
        //-------------
        // Configs

        // If auto settings is true
        //  barnesHutOptimize,
        //  barnesHutTheta,
        //  scaling,
        //  jitterTolerence
        // Will be set by the system automatically
        //  preventOverlap will be set false
        //  if node size is not given
        this.autoSettings = true;

        // Barnes Hut
        // http://arborjs.org/docs/barnes-hut
        this.barnesHutOptimize = true;
        this.barnesHutTheta = 1.5;

        // Force Atlas2 Configs
        this.repulsionByDegree = true;

        this.linLogMode = false;

        this.strongGravityMode = false;
        this.gravity = 1.0;

        this.scaling = 1.0;

        this.edgeWeightInfluence = 1.0;
        this.jitterTolerence = 0.1;

        // TODO
        this.preventOverlap = false;
        this.dissuadeHubs = false;

        //
        this.rootRegion = new Region();
        this.rootRegion.centerOfMass = vec2.create();

        this.nodes = [];

        this.edges = [];

        this.bbox = new Float32Array(4);

        this.gravityCenter = null;

        this._massArr = null;

        this._swingingArr = null;

        this._sizeArr = null;

        this._globalSpeed = 0;
    }

    var forceAtlas2Proto = ForceAtlas2.prototype;

    forceAtlas2Proto.initNodes = function(positionArr, massArr, sizeArr) {
        var nNodes = massArr.length;
        this.nodes.length = 0;
        var haveSize = typeof(sizeArr) != 'undefined';
        for (var i = 0; i < nNodes; i++) {
            var node = new GraphNode();
            node.position[0] = positionArr[i * 2];
            node.position[1] = positionArr[i * 2 + 1];
            node.mass = massArr[i];
            if (haveSize) {
                node.size = sizeArr[i];
            }
            this.nodes.push(node);
        }

        this._massArr = massArr;
        this._swingingArr = new Float32Array(nNodes);

        if (haveSize) {
            this._sizeArr = sizeArr;
        }
    };

    forceAtlas2Proto.initEdges = function(edgeArr, edgeWeightArr) {
        var nEdges = edgeArr.length / 2;
        this.edges.length = 0;
        for (var i = 0; i < nEdges; i++) {
            var sIdx = edgeArr[i * 2];
            var tIdx = edgeArr[i * 2 + 1];
            var sNode = this.nodes[sIdx];
            var tNode = this.nodes[tIdx];

            if (!sNode || !tNode) {
                console.error('Node not exists, try initNodes before initEdges');
                return;
            }
            sNode.outDegree++;
            tNode.inDegree++;
            var edge = new GraphEdge(sNode, tNode);

            if (edgeWeightArr) {
                edge.weight = edgeWeightArr[i];
            }

            this.edges.push(edge);
        }
    }

    forceAtlas2Proto.updateSettings = function() {
        if (this.repulsionByDegree) {
            for (var i = 0; i < this.nodes.length; i++) {
                var node = this.nodes[i];
                node.mass = node.inDegree + node.outDegree + 1;
            }
        }
        else {
            for (var i = 0; i < this.nodes.length; i++) {
                var node = this.nodes[i];
                node.mass = this._massArr[i];
            }
        }
    };

    forceAtlas2Proto.update = function() {
        var nNodes = this.nodes.length;

        this.updateSettings();

        this.updateBBox();

        // Update region
        if (this.barnesHutOptimize) {
            this.rootRegion.setBBox(
                this.bbox[0], this.bbox[1],
                this.bbox[2], this.bbox[3]
            );

            this.rootRegion.beforeUpdate();
            for (var i = 0; i < nNodes; i++) {
                this.rootRegion.addNode(this.nodes[i]);
            }
            this.rootRegion.afterUpdate();
        }

        // Reset forces
        for (var i = 0; i < nNodes; i++) {
            var node = this.nodes[i];
            vec2.copy(node.forcePrev, node.force);
            vec2.set(node.force, 0, 0);
        }

        // Compute forces
        // Repulsion
        for (var i = 0; i < nNodes; i++) {
            var na = this.nodes[i];
            if (this.barnesHutOptimize) {
                this.applyRegionToNodeRepulsion(this.rootRegion, na);
            }
            else {
                for (var j = i + 1; j < nNodes; j++) {
                    var nb = this.nodes[j];
                    this.applyNodeToNodeRepulsion(na, nb, false);
                }
            }

            // Gravity
            if (this.gravity > 0) {
                if (this.strongGravityMode) {
                    this.applyNodeStrongGravity(na);
                }
                else {
                    this.applyNodeGravity(na);
                }
            }
        }

        // Attraction
        for (var i = 0; i < this.edges.length; i++) {
            this.applyEdgeAttraction(this.edges[i]);
        }

        // Handle swinging
        var swingWeightedSum = 0;
        var tractionWeightedSum = 0;
        var tmp = vec2.create();
        for (var i = 0; i < nNodes; i++) {
            var node = this.nodes[i];
            var swing = vec2.dist(node.force, node.forcePrev);
            swingWeightedSum += swing * node.mass;

            vec2.add(tmp, node.force, node.forcePrev);
            var traction = vec2.len(tmp) * 0.5;
            tractionWeightedSum += traction * node.mass;

            // Save the value for using later
            this._swingingArr[i] = swing;
        }
        var globalSpeed = this.jitterTolerence * this.jitterTolerence
                        * tractionWeightedSum / swingWeightedSum;
        // NB: During our tests we observed that an excessive rise of the global speed could have a negative impact.
        // That’s why we limited the increase of global speed s(t)(G) to 50% of the previous step s(t−1)(G).
        if (this._globalSpeed > 0) {
            globalSpeed = Math.min(globalSpeed / this._globalSpeed, 1.5) * this._globalSpeed;
        }
        this._globalSpeed = globalSpeed;

        // Apply forces
        for (var i = 0; i < nNodes; i++) {
            var node = this.nodes[i];
            var swing = this._swingingArr[i];

            var speed = 0.1 * globalSpeed / (1 + globalSpeed * Math.sqrt(swing));

            // Additional constraint to prevent local speed gets too high
            var df = vec2.len(node.force);
            if (df > 0) {
                speed = Math.min(df * speed, 10) / df;
                vec2.scaleAndAdd(node.position, node.position, node.force, speed);
            }
        }
    };

    forceAtlas2Proto.applyRegionToNodeRepulsion = (function() {
        var v = vec2.create();
        return function applyRegionToNodeRepulsion(region, node) {
            if (region.node) { // Region is a leaf
                this.applyNodeToNodeRepulsion(region.node, node, true);
            }
            else {
                vec2.sub(v, node.position, region.centerOfMass);
                var d2 = v[0] * v[0] + v[1] * v[1];
                if (d2 > this.barnesHutTheta * region.size * region.size) {
                    var factor = this.scaling * node.mass * region.mass / d2;
                    vec2.scaleAndAdd(node.force, node.force, v, factor);
                }
                else {
                    for (var i = 0; i < region.nSubRegions; i++) {
                        this.applyRegionToNodeRepulsion(region.subRegions[i], node);
                    }
                }
            }
        }
    })();

    forceAtlas2Proto.applyNodeToNodeRepulsion = (function() {
        var v = vec2.create();
        return function applyNodeToNodeRepulsion(na, nb, oneWay) {
            if (na == nb) {
                return;
            }
            vec2.sub(v, na.position, nb.position);
            var d2 = v[0] * v[0] + v[1] * v[1];

            // PENDING
            if (d2 === 0) {
                return;
            }

            var factor;
            if (this.preventOverlap) {
                var d = Math.sqrt(d2);
                d = d - na.size - nb.size;
                if (d > 0) {
                    factor = this.scaling * na.mass * nb.mass / (d * d);
                }
                else if (d < 0) {
                    // A stronger repulsion if overlap
                    factor = this.scaling * 100 * na.mass * nb.mass;
                }
                else {
                    // No repulsion
                    return;
                }
            }
            else {
                // Divide factor by an extra `d` to normalize the `v`
                factor = this.scaling * na.mass * nb.mass / d2;
            }

            vec2.scaleAndAdd(na.force, na.force, v, factor);
            vec2.scaleAndAdd(nb.force, nb.force, v, -factor);
        }
    })();

    forceAtlas2Proto.applyEdgeAttraction = (function() {
        var v = vec2.create();
        return function applyEdgeAttraction(edge) {
            var na = edge.source;
            var nb = edge.target;

            vec2.sub(v, na.position, nb.position);
            var d = vec2.len(v);

            var w;
            if (this.edgeWeightInfluence === 0) {
                w = 1;
            }
            else if (this.edgeWeightInfluence === 1) {
                w = edge.weight;
            }
            else {
                w = Math.pow(edge.weight, this.edgeWeightInfluence);
            }

            var factor;

            if (this.preventOverlap) {
                d = d - na.size - nb.size;
                if (d <= 0) {
                    // No attraction
                    return;
                }
            }

            if (this.linLogMode) {
                // Divide factor by an extra `d` to normalize the `v`
                factor = - w * Math.log(d + 1) / (d + 1);
            }
            else {
                factor = - w;
            }
            vec2.scaleAndAdd(na.force, na.force, v, factor);
            vec2.scaleAndAdd(nb.force, nb.force, v, -factor);
        }
    })();

    forceAtlas2Proto.applyNodeGravity = (function() {
        var v = vec2.create();
        return function(node) {
            vec2.sub(v, this.gravityCenter, node.position);
            var d = vec2.len(v);
            vec2.scaleAndAdd(node.force, node.force, v, this.gravity * node.mass / (d + 1));
        }
    })();

    forceAtlas2Proto.applyNodeStrongGravity = (function() {
        var v = vec2.create();
        return function(node) {
            vec2.sub(v, this.gravityCenter, node.position);
            vec2.scaleAndAdd(node.force, node.force, v, this.gravity * node.mass);
        }
    })();

    forceAtlas2Proto.updateBBox = function() {
        var minX = Infinity;
        var minY = Infinity;
        var maxX = -Infinity;
        var maxY = -Infinity;
        for (var i = 0; i < this.nodes.length; i++) {
            var pos = this.nodes[i].position;
            minX = Math.min(minX, pos[0]);
            minY = Math.min(minY, pos[1]);
            maxX = Math.max(maxX, pos[0]);
            maxY = Math.max(maxY, pos[1]);
        }
        this.bbox[0] = minX;
        this.bbox[1] = minY;
        this.bbox[2] = maxX;
        this.bbox[3] = maxY;
    };

    forceAtlas2Proto.getGlobalSpeed = function () {
        return this._globalSpeed;
    }

    /****************************
     * Main process
     ***************************/

    var forceAtlas2 = null;

    self.onmessage = function(e) {
        switch(e.data.cmd) {
            case 'init':
                forceAtlas2 = new ForceAtlas2();
                forceAtlas2.initNodes(e.data.nodesPosition, e.data.nodesMass, e.data.nodesSize);
                forceAtlas2.initEdges(e.data.edges, e.data.edgesWeight);
                break;
            case 'updateConfig':
                if (forceAtlas2) {
                    for (var name in e.data.config) {
                        forceAtlas2[name] = e.data.config[name];
                    }
                }
                break;
            case 'update':
                var steps = e.data.steps;
                if (forceAtlas2) {
                    for (var i = 0; i < steps; i++) {
                        forceAtlas2.update();
                    }

                    var nNodes = forceAtlas2.nodes.length;
                    var positionArr = new Float32Array(nNodes * 2);
                    // Callback
                    for (var i = 0; i < nNodes; i++) {
                        var node = forceAtlas2.nodes[i];
                        positionArr[i * 2] = node.position[0];
                        positionArr[i * 2 + 1] = node.position[1];
                    }
                    self.postMessage({
                        buffer: positionArr.buffer,
                        globalSpeed: forceAtlas2.getGlobalSpeed()
                    }, [positionArr.buffer]);
                }
                else {
                    // Not initialzied yet
                    var emptyArr = new Float32Array();
                    // Post transfer object
                    self.postMessage({
                        buffer: emptyArr.buffer,
                        globalSpeed: forceAtlas2.getGlobalSpeed()
                    }, [emptyArr.buffer]);
                }
                break;
        }
    }
}

export default forceAtlas2Worker;