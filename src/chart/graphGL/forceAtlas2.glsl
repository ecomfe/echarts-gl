@export ecgl.forceAtlas2.updateNodeRepulsion

#define NODE_COUNT 0

uniform sampler2D positionTex;

uniform vec2 textureSize;
uniform float gravity;
uniform float scaling;
uniform vec2 gravityCenter;

uniform bool strongGravityMode;
uniform bool preventOverlap;

varying vec2 v_Texcoord;

void main() {

    vec4 n0 = texture2D(positionTex, v_Texcoord);

    vec2 force = vec2(0.0);
    for (int i = 0; i < NODE_COUNT; i++) {
        vec2 uv = vec2(
            mod(float(i), textureSize.x) / (textureSize.x - 1.0),
            floor(float(i) / textureSize.x) / (textureSize.y - 1.0)
        );
        vec4 n1 = texture2D(positionTex, uv);

        vec2 dir = n0.xy - n1.xy;
        float d2 = dot(dir, dir);

        if (d2 > 0.0) {
            float factor = 0.0;
            if (preventOverlap) {
                float d = sqrt(d2);
                d = d - n0.w - n1.w;
                if (d > 0.0) {
                    factor = scaling * n0.z * n1.z / (d * d);
                }
                else if (d < 0.0) {
                    // A stronger repulsion if overlap
                    factor = scaling * 100.0 * n0.z * n1.z;
                }
            }
            else {
                // Divide factor by an extra `d` to normalize the `v`
                factor = scaling * n0.z * n1.z / d2;
            }
            force += dir * factor;
        }
    }

    // Gravity
    vec2 dir = gravityCenter - n0.xy;
    float d = 1.0;
    if (!strongGravityMode) {
        d = length(dir);
    }

    force += dir * n0.z * gravity / (d + 1.0);

    gl_FragColor = vec4(force, 0.0, 1.0);
}
@end

@export ecgl.forceAtlas2.updateEdgeAttraction.vertex

attribute vec2 node1;
attribute vec2 node2;
attribute float weight;

uniform sampler2D positionTex;
uniform float edgeWeightInfluence;
uniform bool preventOverlap;
uniform bool linLogMode;

uniform vec2 windowSize: WINDOW_SIZE;

varying vec2 v_Force;

void main() {

    vec4 n0 = texture2D(positionTex, node1);
    vec4 n1 = texture2D(positionTex, node2);

    vec2 dir = n1.xy - n0.xy;
    float d = length(dir);
    float w;
    if (edgeWeightInfluence == 0.0) {
        w = 1.0;
    }
    else if (edgeWeightInfluence == 1.0) {
        w = weight;
    }
    else {
        w = pow(weight, edgeWeightInfluence);
    }
    // Add 0.5 offset.
    // PENDING.
    vec2 offset = vec2(1.0 / windowSize.x, 1.0 / windowSize.y);
    vec2 scale = vec2((windowSize.x - 1.0) / windowSize.x, (windowSize.y - 1.0) / windowSize.y);
    vec2 pos = node1 * scale * 2.0 - 1.0;
    gl_Position = vec4(pos + offset, 0.0, 1.0);
    gl_PointSize = 1.0;

    float factor;
    if (preventOverlap) {
        d = d - n1.w - n0.w;
    }
    if (d <= 0.0) {
        v_Force = vec2(0.0);
        return;
    }

    if (linLogMode) {
        // Divide factor by an extra `d` to normalize the `v`
        factor = w * log(d) / d;
    }
    else {
        factor = w;
    }
    v_Force = dir * factor;
}
@end

@export ecgl.forceAtlas2.updateEdgeAttraction.fragment

varying vec2 v_Force;

void main() {
    gl_FragColor = vec4(v_Force, 0.0, 0.0);
}
@end

@export ecgl.forceAtlas2.calcWeightedSum.vertex

attribute vec2 node;

varying vec2 v_NodeUv;

void main() {

    v_NodeUv = node;
    gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
    gl_PointSize = 1.0;
}
@end

@export ecgl.forceAtlas2.calcWeightedSum.fragment

varying vec2 v_NodeUv;

uniform sampler2D positionTex;
uniform sampler2D forceTex;
uniform sampler2D forcePrevTex;

void main() {
    vec2 force = texture2D(forceTex, v_NodeUv).rg;
    vec2 forcePrev = texture2D(forcePrevTex, v_NodeUv).rg;

    float mass = texture2D(positionTex, v_NodeUv).z;
    float swing = length(force - forcePrev) * mass;
    float traction = length(force + forcePrev) * 0.5 * mass;

    gl_FragColor = vec4(swing, traction, 0.0, 0.0);
}
@end

@export ecgl.forceAtlas2.calcGlobalSpeed

uniform sampler2D globalSpeedPrevTex;
uniform sampler2D weightedSumTex;
uniform float jitterTolerence;

void main() {
    vec2 weightedSum = texture2D(weightedSumTex, vec2(0.5)).xy;
    float prevGlobalSpeed = texture2D(globalSpeedPrevTex, vec2(0.5)).x;
    float globalSpeed = jitterTolerence * jitterTolerence
        // traction / swing
        * weightedSum.y / weightedSum.x;
    if (prevGlobalSpeed > 0.0) {
        globalSpeed = min(globalSpeed / prevGlobalSpeed, 1.5) * prevGlobalSpeed;
    }
    gl_FragColor = vec4(globalSpeed, 0.0, 0.0, 1.0);
}
@end

@export ecgl.forceAtlas2.updatePosition

uniform sampler2D forceTex;
uniform sampler2D forcePrevTex;
uniform sampler2D positionTex;
uniform sampler2D globalSpeedTex;

varying vec2 v_Texcoord;

void main() {
    vec2 force = texture2D(forceTex, v_Texcoord).xy;
    vec2 forcePrev = texture2D(forcePrevTex, v_Texcoord).xy;
    vec4 node = texture2D(positionTex, v_Texcoord);

    float globalSpeed = texture2D(globalSpeedTex, vec2(0.5)).r;
    float swing = length(force - forcePrev);
    float speed = 0.1 * globalSpeed / (0.1 + globalSpeed * sqrt(swing));

    // Additional constraint to prevent local speed gets too high
    float df = length(force);
    if (df > 0.0) {
        speed = min(df * speed, 10.0) / df;

        gl_FragColor = vec4(node.xy + speed * force, node.zw);
    }
    else {
        gl_FragColor = node;
    }
}
@end

// For edge draw
@export ecgl.forceAtlas2.edges.vertex
uniform mat4 worldViewProjection : WORLDVIEWPROJECTION;

attribute vec2 node;
attribute vec4 a_Color : COLOR;
varying vec4 v_Color;

uniform sampler2D positionTex;

void main()
{
    gl_Position = worldViewProjection * vec4(
        texture2D(positionTex, node).xy, -10.0, 1.0
    );
    v_Color = a_Color;
}
@end

@export ecgl.forceAtlas2.edges.fragment
uniform vec4 color : [1.0, 1.0, 1.0, 1.0];
varying vec4 v_Color;
void main() {
    gl_FragColor = color * v_Color;
}
@end