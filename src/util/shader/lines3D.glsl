@export ecgl.lines3D.vertex

uniform mat4 worldViewProjection : WORLDVIEWPROJECTION;

attribute vec3 position: POSITION;
attribute vec4 a_Color : COLOR;
varying vec4 v_Color;

void main()
{
    gl_Position = worldViewProjection * vec4(position, 1.0);
    v_Color = a_Color;
}

@end

@export ecgl.lines3D.fragment

uniform vec3 color : [1.0, 1.0, 1.0];
uniform float alpha : 1.0;

varying vec4 v_Color;

void main()
{
    gl_FragColor = vec4(color, alpha) * v_Color;
}
@end


@export ecgl.meshLines3D.vertex

// https://mattdesl.svbtle.com/drawing-lines-is-hard
attribute vec3 position: POSITION;
attribute vec3 positionPrev;
attribute vec3 positionNext;
attribute float offset;
attribute vec4 a_Color : COLOR;

uniform mat4 worldViewProjection : WORLDVIEWPROJECTION;
uniform vec4 viewport : VIEWPORT;
uniform float near : NEAR;

varying vec4 v_Color;
varying float v_Miter;

vec4 clipNear(vec4 p1, vec4 p2) {
    float n = (p1.w - near) / (p1.w - p2.w);
    float xc = n * p1.x + (1.0-n) * p2.x;
    float yc = n * p1.y + (1.0-n) * p2.y;
    return vec4(xc, yc, -near, near);
}

void main()
{
    vec4 prevProj = worldViewProjection * vec4(positionPrev, 1.0);
    vec4 currProj = worldViewProjection * vec4(position, 1.0);
    vec4 nextProj = worldViewProjection * vec4(positionNext, 1.0);

    if (currProj.w < 0.0) {
        if (prevProj.w < 0.0) {
            currProj = clipNear(currProj, nextProj);
        }
        else {
            currProj = clipNear(currProj, prevProj);
        }
    }

    vec2 prevScreen = (prevProj.xy / abs(prevProj.w) + 1.0) * 0.5 * viewport.zw;
    vec2 currScreen = (currProj.xy / abs(currProj.w) + 1.0) * 0.5 * viewport.zw;
    vec2 nextScreen = (nextProj.xy / abs(nextProj.w) + 1.0) * 0.5 * viewport.zw;


    vec2 dir;
    float len = offset;
    // Start point
    if (position == positionPrev) {
        dir = normalize(nextScreen - currScreen);
        v_Miter = 1.0;
    }
    // End point
    else if (position == positionNext) {
        dir = normalize(currScreen - prevScreen);
        v_Miter = 1.0;
    }
    else {
        vec2 dirA = normalize(currScreen - prevScreen);
        vec2 dirB = normalize(nextScreen - currScreen);

        vec2 tanget = normalize(dirA + dirB);

        v_Miter = 1.0 / max(dot(tanget, dirA), 0.5);
        len *= v_Miter;
        dir = tanget;
    }

    dir = vec2(-dir.y, dir.x) * len;
    currScreen += dir;

    currProj.xy = (currScreen / viewport.zw - 0.5) * 2.0 * abs(currProj.w);
    // PENDING
    gl_Position = currProj;
    gl_PointSize = 4.0;
    v_Color = a_Color;
}
@end


@export ecgl.meshLines3D.fragment

uniform vec3 color : [1.0, 1.0, 1.0];
uniform float alpha : 1.0;

varying vec4 v_Color;
varying float v_Miter;

void main()
{
    // TODO Fadeout pixels v_Miter > 1
    gl_FragColor = vec4(color, alpha) * v_Color;
}

@end