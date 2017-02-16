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

varying vec4 v_Color;
varying float v_Miter;

void main()
{
    vec4 previousProjected = worldViewProjection * vec4(positionPrev, 1.0);
    vec4 currentProjected = worldViewProjection * vec4(position, 1.0);
    vec4 nextProjected = worldViewProjection * vec4(positionNext, 1.0);

    vec2 previousScreen = (previousProjected.xy / previousProjected.w + 1.0) * 0.5 * viewport.zw;
    vec2 currentScreen = (currentProjected.xy / currentProjected.w + 1.0) * 0.5 * viewport.zw;
    vec2 nextScreen = (nextProjected.xy / nextProjected.w + 1.0) * 0.5 * viewport.zw;

    vec2 dir;
    float len = offset;
    // Start point
    if (position == positionPrev) {
        dir = normalize(nextScreen - currentScreen);
        v_Miter = 1.0;
    }
    // End point
    else if (position == positionNext) {
        dir = normalize(currentScreen - previousScreen);
        v_Miter = 1.0;
    }
    else {
        vec2 dirA = normalize(currentScreen - previousScreen);
        vec2 dirB = normalize(nextScreen - currentScreen);

        vec2 tanget = normalize(dirA + dirB);

        v_Miter = 1.0 / max(dot(tanget, dirA), 0.5);
        len *= v_Miter;
        dir = tanget;
    }

    dir = vec2(-dir.y, dir.x) * len;
    currentScreen += dir;

    currentProjected.xy = (currentScreen / viewport.zw - 0.5) * 2.0 * currentProjected.w;
    // PENDING
    gl_Position = currentProjected;
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